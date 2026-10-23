function safeJavaName(name) {
  const words = name.trim().match(/[A-Za-z0-9_$]+/g) ?? [];
  const result = words.map((word) => word[0].toUpperCase() + word.slice(1)).join('');
  return /^[A-Za-z_$]/.test(result) ? result : `Class${result}`;
}

function javaType(type = 'String') {
  return type.trim() || 'String';
}

export function visibilityMarker(member, fallback) {
  return member.trim().match(/^([+#~-])/)?.[1] ?? fallback;
}

function attributeParts(attribute) {
  const marker = visibilityMarker(attribute, '-');
  const cleaned = attribute.trim().replace(/^[+#~-]\s*/, '');
  const [name = 'field', type = 'String'] = cleaned.split(':');
  const visibility = { '+': 'public', '-': 'private', '#': 'protected', '~': '' }[marker];
  return { name: name.trim(), type: javaType(type), visibility };
}

function methodParts(method) {
  const marker = visibilityMarker(method, '+');
  const cleaned = method.trim().replace(/^[+#~-]\s*/, '');
  const match = cleaned.match(/^([A-Za-z_$][\w$]*)\s*\((.*)\)\s*(?::\s*(.+))?$/);
  const visibility = { '+': 'public', '-': 'private', '#': 'protected', '~': '' }[marker];
  if (!match) return { name: 'method', parameters: '', parameterTypes: [], returnType: 'void', visibility };
  const parsedParameters = match[2].trim().split(',').filter(Boolean).map((parameter, index) => {
    const [name, type] = parameter.split(':').map((part) => part.trim());
    return { name: name || `arg${index + 1}`, type: javaType(type) };
  });
  const parameters = parsedParameters.map(({ name, type }) => `${type} ${name}`).join(', ');
  return {
    name: match[1],
    parameters,
    parameterTypes: parsedParameters.map(({ type }) => type),
    returnType: javaType(match[3] || 'void'),
    visibility,
  };
}

function defaultJavaValue(type) {
  if (type === 'boolean') return 'false';
  if (['byte', 'short', 'int', 'long', 'float', 'double', 'char'].includes(type)) return '0';
  return 'null';
}

function isMany(end) {
  return /^(?:\*|many|n)$/i.test(end.trim());
}

function associationIsMany(relationship, classId) {
  const multiplicities = relationship.label.match(/(?:\*|many|n|\d+)\s*(?:to|\.\.)\s*(?:\*|many|n|\d+)/i);
  if (!multiplicities) return false;
  const ends = multiplicities[0].split(/\s*(?:to|\.\.)\s*/i);
  return isMany(classId === relationship.from ? ends[1] : ends[0]);
}

function memberName(className, plural) {
  const name = safeJavaName(className);
  const property = name[0].toLowerCase() + name.slice(1);
  return plural && !property.endsWith('s') ? `${property}s` : property;
}

const JAVA_IMPORTS = {
  ArrayList: 'java.util.ArrayList',
  BigDecimal: 'java.math.BigDecimal',
  Collection: 'java.util.Collection',
  HashMap: 'java.util.HashMap',
  Instant: 'java.time.Instant',
  LocalDate: 'java.time.LocalDate',
  LocalDateTime: 'java.time.LocalDateTime',
  Map: 'java.util.Map',
  OffsetDateTime: 'java.time.OffsetDateTime',
  Optional: 'java.util.Optional',
  Set: 'java.util.Set',
  List: 'java.util.List',
  UUID: 'java.util.UUID',
  ZonedDateTime: 'java.time.ZonedDateTime',
};

function generateJava(umlClass, classes, relationships) {
  const parentRelationship = relationships.find(
    (relationship) => relationship.type === 'inheritance' && relationship.from === umlClass.id,
  );
  const parent = classes.find((item) => item.id === parentRelationship?.to);
  const declaration = `${safeJavaName(umlClass.name)}${parent ? ` extends ${safeJavaName(parent.name)}` : ''}`;
  const associationFields = relationships
    .filter((relationship) => relationship.type === 'association' && (relationship.from === umlClass.id || relationship.to === umlClass.id))
    .flatMap((relationship) => {
      const targetId = relationship.from === umlClass.id ? relationship.to : relationship.from;
      const target = classes.find((item) => item.id === targetId);
      if (!target) return [];
      const many = associationIsMany(relationship, umlClass.id);
      const targetName = safeJavaName(target.name);
      return [`    private ${many ? `List<${targetName}>` : targetName} ${memberName(target.name, many)};`];
    });
  const dependencyComments = relationships
    .filter((relationship) => relationship.type === 'dependency' && relationship.from === umlClass.id)
    .map((relationship) => classes.find((item) => item.id === relationship.to))
    .filter(Boolean)
    .map((target) => `    // Depends on ${safeJavaName(target.name)}`);
  const fields = umlClass.attributes.map(({ name, type, visibility }) => (
    `    ${visibility ? `${visibility} ` : ''}${type} ${name};`
  )).concat(associationFields);
  const methods = umlClass.methods.map(({ name, parameters, returnType, visibility }) => (
    `    ${visibility ? `${visibility} ` : ''}${returnType} ${name}(${parameters}) {\n        // TODO: implement\n${returnType === 'void' ? '' : `        return ${defaultJavaValue(returnType)};\n`}    }`
  ));
  const referencedTypes = [
    ...umlClass.attributes.map(({ type }) => type),
    ...umlClass.methods.flatMap(({ returnType, parameterTypes }) => [returnType, ...parameterTypes]),
    ...relationships
      .filter((relationship) => relationship.type === 'association' && (relationship.from === umlClass.id || relationship.to === umlClass.id))
      .map((relationship) => classes.find((item) => item.id === (relationship.from === umlClass.id ? relationship.to : relationship.from)))
      .filter(Boolean)
      .map((target) => target.name),
  ];
  if (associationFields.some((field) => field.includes('List<'))) referencedTypes.push('List');
  const imports = [...new Set(referencedTypes.flatMap((type) => (
    type.match(/[A-Z][A-Za-z0-9_$]*/g) ?? []
  )).map((type) => JAVA_IMPORTS[type]).filter(Boolean))].sort();
  return [
    ...(imports.length ? [...imports.map((path) => `import ${path};`), ''] : []),
    `public class ${declaration} {`,
    ...(fields.length || dependencyComments.length ? ['', ...dependencyComments, ...fields] : []),
    ...(methods.length ? ['', ...methods] : []),
    '}',
    '',
  ].join('\n');
}

export function makeJavaFiles(classes, relationships) {
  return classes.map((umlClass) => ({
    name: `${safeJavaName(umlClass.name)}.java`,
    code: generateJava({
      ...umlClass,
      attributes: umlClass.attributes.map(attributeParts),
      methods: umlClass.methods.map(methodParts),
    }, classes, relationships),
  }));
}

export function zipFiles(files) {
  const encoder = new TextEncoder();
  const write16 = (view, offset, value) => view.setUint16(offset, value, true);
  const write32 = (view, offset, value) => view.setUint32(offset, value, true);
  const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  let centralSize = 0;
  files.forEach((file) => {
    const name = encoder.encode(file.name);
    const content = encoder.encode(file.code);
    const checksum = crc32(content);
    const local = new Uint8Array(30 + name.length + content.length);
    const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50);
    write16(localView, 4, 20);
    write16(localView, 6, 0x0800);
    write32(localView, 14, checksum);
    write32(localView, 18, content.length);
    write32(localView, 22, content.length);
    write16(localView, 26, name.length);
    local.set(name, 30);
    local.set(content, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014b50);
    write16(centralView, 4, 20);
    write16(centralView, 6, 20);
    write16(centralView, 8, 0x0800);
    write32(centralView, 16, checksum);
    write32(centralView, 20, content.length);
    write32(centralView, 24, content.length);
    write16(centralView, 28, name.length);
    write32(centralView, 42, localOffset);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length;
    centralSize += central.length;
  });

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50);
  write16(endView, 8, files.length);
  write16(endView, 10, files.length);
  write32(endView, 12, centralSize);
  write32(endView, 16, localOffset);
  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}
