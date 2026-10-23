import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp,
  ArrowRight,
  Braces,
  Check,
  ChevronDown,
  CircleHelp,
  Code2,
  Copy,
  Download,
  Ellipsis,
  FileCode2,
  GitBranch,
  Grip,
  Hand,
  Link2,
  Minus,
  MousePointer2,
  Network,
  Plus,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { makeJavaFiles, visibilityMarker, zipFiles } from './javaGenerator.js';

const INITIAL_CLASSES = [
  {
    id: 'customer',
    name: 'Customer',
    x: 130,
    y: 145,
    attributes: ['- id: Long', '- name: String', '- email: String'],
    methods: ['+ placeOrder(): Order', '+ updateProfile(): void'],
  },
  {
    id: 'order',
    name: 'Order',
    x: 490,
    y: 105,
    attributes: ['- orderId: Long', '- date: LocalDate', '- status: String'],
    methods: ['+ calculateTotal(): double', '+ confirm(): void'],
  },
  {
    id: 'product',
    name: 'Product',
    x: 490,
    y: 395,
    attributes: ['- sku: String', '- name: String', '- price: double'],
    methods: ['+ getPrice(): double'],
  },
  {
    id: 'payment',
    name: 'Payment',
    x: 850,
    y: 220,
    attributes: ['- amount: double', '- transactionId: String'],
    methods: ['+ process(): boolean', '+ refund(): void'],
  },
];

const INITIAL_RELATIONSHIPS = [
  { id: 'r1', from: 'customer', to: 'order', type: 'association', label: 'places · 1 to *' },
  { id: 'r2', from: 'order', to: 'product', type: 'association', label: 'contains · 1 to *' },
  { id: 'r3', from: 'order', to: 'payment', type: 'dependency', label: 'uses' },
];

const TYPE_META = {
  association: { title: 'Association', icon: Link2, note: 'A connection between two classes.' },
  inheritance: { title: 'Inheritance', icon: GitBranch, note: 'Click child first, then its parent.' },
  dependency: { title: 'Dependency', icon: ArrowDownUp, note: 'A class depends on another class.' },
};

const CLASS_WIDTH = 238;
const HEADER_HEIGHT = 45;
const ROW_HEIGHT = 31;
const CLASS_PADDING = 14;
const STORAGE_KEY = 'classcraft-uml-diagram-v1';

function readSavedDiagram() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { classes: INITIAL_CLASSES, relationships: INITIAL_RELATIONSHIPS };
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.classes) || !Array.isArray(parsed.relationships)) {
      throw new Error('Saved diagram has an invalid format.');
    }
    return parsed;
  } catch (error) {
    console.error('Unable to restore the saved UML diagram:', error);
    return { classes: INITIAL_CLASSES, relationships: INITIAL_RELATIONSHIPS };
  }
}

function classHeight(umlClass) {
  return HEADER_HEIGHT + Math.max(1, umlClass.attributes.length) * ROW_HEIGHT
    + Math.max(1, umlClass.methods.length) * ROW_HEIGHT + 2;
}

function IconButton({ title, onClick, children, className = '', disabled = false }) {
  return (
    <button className={`icon-button ${className}`} title={title} aria-label={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function BrandMark() {
  return <span className="brand-mark"><Network size={18} strokeWidth={2.2} /></span>;
}

function ClassCard({ umlClass, isSelected, onPointerDown, onClick, onDoubleClick, onDelete }) {
  return (
    <g
      className={`uml-class ${isSelected ? 'selected' : ''}`}
      transform={`translate(${umlClass.x} ${umlClass.y})`}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      role="button"
      tabIndex={0}
      aria-label={`${umlClass.name} UML class`}
    >
      <rect className="class-card" width={CLASS_WIDTH} height={classHeight(umlClass)} rx="9" />
      <path className="class-header" d={`M 9 0 H ${CLASS_WIDTH - 9} Q ${CLASS_WIDTH} 0 ${CLASS_WIDTH} 9 V ${HEADER_HEIGHT} H 0 V 9 Q 0 0 9 0`} />
      <text className="class-stereotype" x={CLASS_WIDTH / 2} y="16" textAnchor="middle">«class»</text>
      <text className="class-name" x={CLASS_WIDTH / 2} y="35" textAnchor="middle">{umlClass.name || 'Untitled'}</text>
      <line className="compartment-line" x1="0" y1={HEADER_HEIGHT} x2={CLASS_WIDTH} y2={HEADER_HEIGHT} />
      {umlClass.attributes.length ? umlClass.attributes.map((attribute, index) => (
        <text className="class-member" key={`attribute-${index}`} x={CLASS_PADDING} y={HEADER_HEIGHT + 21 + index * ROW_HEIGHT}>
          {attribute || ' '}
        </text>
      )) : <text className="empty-member" x={CLASS_PADDING} y={HEADER_HEIGHT + 21}>—</text>}
      <line
        className="compartment-line"
        x1="0"
        y1={HEADER_HEIGHT + Math.max(1, umlClass.attributes.length) * ROW_HEIGHT}
        x2={CLASS_WIDTH}
        y2={HEADER_HEIGHT + Math.max(1, umlClass.attributes.length) * ROW_HEIGHT}
      />
      {(umlClass.methods.length ? umlClass.methods : ['']).map((method, index) => (
        <text className="class-member" key={`method-${index}`} x={CLASS_PADDING} y={HEADER_HEIGHT + Math.max(1, umlClass.attributes.length) * ROW_HEIGHT + 21 + index * ROW_HEIGHT}>
          {method || '—'}
        </text>
      ))}
      {isSelected && (
        <g className="class-delete" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}>
          <circle cx={CLASS_WIDTH - 1} cy="1" r="12" />
          <text x={CLASS_WIDTH - 1} y="5" textAnchor="middle">×</text>
        </g>
      )}
    </g>
  );
}

function RelationshipLine({ relationship, fromClass, toClass, isSelected, onClick }) {
  if (!fromClass || !toClass) return null;
  const start = {
    x: fromClass.x + CLASS_WIDTH / 2,
    y: fromClass.y + classHeight(fromClass) / 2,
  };
  const end = {
    x: toClass.x + CLASS_WIDTH / 2,
    y: toClass.y + classHeight(toClass) / 2,
  };
  const sameSide = Math.abs(end.x - start.x) > Math.abs(end.y - start.y);
  if (sameSide) {
    start.x = fromClass.x + (end.x > start.x ? CLASS_WIDTH : 0);
    end.x = toClass.x + (end.x > start.x ? 0 : CLASS_WIDTH);
  } else {
    start.y = fromClass.y + (end.y > start.y ? classHeight(fromClass) : 0);
    end.y = toClass.y + (end.y > start.y ? 0 : classHeight(toClass));
  }
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  return (
    <g className={`relationship ${isSelected ? 'selected' : ''}`} onClick={onClick} role="button" aria-label={`${relationship.type} relationship`}>
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
      {relationship.type === 'dependency' && (
        <path d={`M ${end.x - 6} ${end.y - 5} L ${end.x} ${end.y} L ${end.x - 6} ${end.y + 5}`} transform={`rotate(${Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI} ${end.x} ${end.y})`} />
      )}
      {relationship.type === 'inheritance' && <polygon className="inheritance-head" points={`${end.x},${end.y} ${end.x - 8},${end.y + 16} ${end.x + 8},${end.y + 16}`} transform={`rotate(${Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI + 90} ${end.x} ${end.y})`} />}
      {relationship.label && <text x={midX} y={midY - 8} textAnchor="middle">{relationship.label}</text>}
    </g>
  );
}

function Inspector({ selectedClass, selectedRelationship, updateClass, updateRelationship, onDeleteClass, onDeleteRelationship }) {
  const [newAttribute, setNewAttribute] = useState('');
  const [newMethod, setNewMethod] = useState('');
  if (selectedRelationship) {
    const meta = TYPE_META[selectedRelationship.type];
    const RelationIcon = meta.icon;
    return (
      <aside className="inspector panel">
        <div className="panel-heading"><div><span className="eyebrow">RELATIONSHIP</span><h2>Connection details</h2></div><span className={`relation-icon ${selectedRelationship.type}`}><RelationIcon size={17} /></span></div>
        <label className="field-label">Relationship type</label>
        <div className="readonly-type"><span className={`type-dot ${selectedRelationship.type}`} />{meta.title}<ChevronDown size={15} /></div>
        <label className="field-label" htmlFor="relationship-label">Label <span>optional</span></label>
        <input id="relationship-label" className="text-input" value={selectedRelationship.label} onChange={(event) => updateRelationship({ label: event.target.value })} placeholder="e.g. places · 1 to *" />
        <p className="field-help">{meta.note}</p>
        <div className="relationship-endpoints"><span>{selectedRelationship.fromName}</span><ArrowRight size={14} /><span>{selectedRelationship.toName}</span></div>
        <button className="danger-button" onClick={onDeleteRelationship}><Trash2 size={15} /> Delete relationship</button>
      </aside>
    );
  }
  if (!selectedClass) {
    return (
      <aside className="inspector panel empty-inspector">
        <div className="empty-inspector-icon"><MousePointer2 size={19} /></div>
        <h3>Select a class to edit</h3>
        <p>Choose a class on the canvas to manage its properties, attributes, and methods.</p>
        <div className="shortcut-hint"><span>TIP</span> Drag classes to rearrange your diagram.</div>
      </aside>
    );
  }
  return (
    <aside className="inspector panel">
      <div className="panel-heading"><div><span className="eyebrow">CLASS PROPERTIES</span><h2>Edit class</h2></div><button className="delete-link" onClick={onDeleteClass}><Trash2 size={14} /><span>Delete</span></button></div>
      <label className="field-label" htmlFor="class-name">Class name</label>
      <input id="class-name" className="text-input name-input" value={selectedClass.name} onChange={(event) => updateClass({ name: event.target.value })} placeholder="e.g. Customer" />
      <div className="section-heading"><span>Attributes</span><span className="count-pill">{selectedClass.attributes.length}</span></div>
      <div className="member-list">
        {selectedClass.attributes.map((attribute, index) => (
          <div className="member-edit" key={`attribute-${index}`}>
            <span className={`visibility-mark ${visibilityMarker(attribute, '-') === '+' ? 'public' : 'private'}`}>{visibilityMarker(attribute, '-')}</span>
            <input aria-label={`Attribute ${index + 1}`} value={attribute} onChange={(event) => updateClass({ attributes: selectedClass.attributes.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} />
            <button className="member-remove" title="Remove attribute" onClick={() => updateClass({ attributes: selectedClass.attributes.filter((_, itemIndex) => itemIndex !== index) })}><X size={14} /></button>
          </div>
        ))}
      </div>
      <form className="add-member-form" onSubmit={(event) => {
        event.preventDefault();
        if (!newAttribute.trim()) return;
        updateClass({ attributes: [...selectedClass.attributes, newAttribute.trim()] });
        setNewAttribute('');
      }}>
        <input value={newAttribute} onChange={(event) => setNewAttribute(event.target.value)} aria-label="New attribute" placeholder="- attributeName: Type" />
        <button title="Add attribute" aria-label="Add attribute"><Plus size={15} /></button>
      </form>
      <p className="format-hint">Use <code>name: Type</code> · + public · − private</p>
      <div className="section-heading methods-heading"><span>Methods</span><span className="count-pill">{selectedClass.methods.length}</span></div>
      <div className="member-list">
        {selectedClass.methods.map((method, index) => (
          <div className="member-edit" key={`method-${index}`}>
            <span className={`visibility-mark ${visibilityMarker(method, '+') === '+' ? 'public' : 'private'}`}>{visibilityMarker(method, '+')}</span>
            <input aria-label={`Method ${index + 1}`} value={method} onChange={(event) => updateClass({ methods: selectedClass.methods.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} />
            <button className="member-remove" title="Remove method" onClick={() => updateClass({ methods: selectedClass.methods.filter((_, itemIndex) => itemIndex !== index) })}><X size={14} /></button>
          </div>
        ))}
      </div>
      <form className="add-member-form" onSubmit={(event) => {
        event.preventDefault();
        if (!newMethod.trim()) return;
        updateClass({ methods: [...selectedClass.methods, newMethod.trim()] });
        setNewMethod('');
      }}>
        <input value={newMethod} onChange={(event) => setNewMethod(event.target.value)} aria-label="New method" placeholder="+ methodName(): ReturnType" />
        <button title="Add method" aria-label="Add method"><Plus size={15} /></button>
      </form>
      <p className="format-hint">Example: <code>+ save(): void</code></p>
      <div className="class-id">CLASS ID <code>{selectedClass.id}</code></div>
    </aside>
  );
}

function CodeModal({ classes, relationships, onClose }) {
  const [activeFile, setActiveFile] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const files = useMemo(() => makeJavaFiles(classes, relationships), [classes, relationships]);
  const currentFile = files[Math.min(activeFile, Math.max(0, files.length - 1))];

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentFile?.code || '');
      setCopied(true);
      setCopyError('');
      window.setTimeout(() => setCopied(false), 1700);
    } catch (error) {
      console.error('Unable to copy Java source:', error);
      setCopyError('Clipboard unavailable. Select and copy the code instead.');
    }
  };

  const downloadFiles = () => {
    try {
      const url = URL.createObjectURL(zipFiles(files));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'uml-java-source.zip';
      document.body.append(link);
      link.click();
      window.setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(url);
      }, 1000);
      setDownloadError('');
    } catch (error) {
      console.error('Unable to download generated Java source:', error);
      setDownloadError('Could not create the ZIP archive.');
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="code-modal" role="dialog" aria-modal="true" aria-labelledby="code-title">
        <header className="modal-header">
          <div className="modal-title-icon"><FileCode2 size={19} /></div>
          <div><h2 id="code-title">Java source code</h2><p>Generated from your UML class diagram</p></div>
          <button className="modal-close" aria-label="Close code generator" onClick={onClose}><X size={19} /></button>
        </header>
        <div className="code-workspace">
          <nav className="file-list" aria-label="Generated Java files">
            <div className="file-list-title">PROJECT FILES <span>{files.length}</span></div>
            {files.length ? files.map((file, index) => (
              <button key={file.name} className={`file-tab ${index === activeFile ? 'active' : ''}`} onClick={() => setActiveFile(index)}>
                <FileCode2 size={15} /><span>{file.name}</span>
              </button>
            )) : <p className="no-files">Add a class to generate Java.</p>}
          </nav>
          <div className="code-view">
            <div className="code-toolbar"><span><span className="java-dot">J</span> {currentFile?.name ?? 'No classes yet'}</span><span className="code-actions">{copyError && <span className="copy-error" role="alert">{copyError}</span>}<button className="copy-button" onClick={copyCode} disabled={!currentFile}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button></span></div>
            <pre className="code-content"><code>{currentFile?.code ?? '// Add a class to generate Java source code.'}</code></pre>
          </div>
        </div>
        <footer className="modal-footer"><span><Sparkles size={14} /> {downloadError || `${files.length} Java ${files.length === 1 ? 'file' : 'files'} ready to export`}</span><button className="download-button" onClick={downloadFiles} disabled={!files.length}><Download size={15} /> Download .zip</button></footer>
      </section>
    </div>
  );
}

function RelationshipToolbar({ activeRelationship, onSelect }) {
  return (
    <div className="relationship-tools">
      {Object.entries(TYPE_META).map(([type, meta]) => {
        const Icon = meta.icon;
        return (
          <button key={type} title={meta.note} className={`relationship-tool ${activeRelationship === type ? 'active' : ''}`} onClick={() => onSelect(activeRelationship === type ? null : type)}>
            <Icon size={15} /><span>{meta.title}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  const [initialDiagram] = useState(readSavedDiagram);
  const [classes, setClasses] = useState(initialDiagram.classes);
  const [relationships, setRelationships] = useState(initialDiagram.relationships);
  const [saveStatus, setSaveStatus] = useState('Saved on this device');
  const [selection, setSelection] = useState({ type: 'class', id: 'customer' });
  const [relationshipMode, setRelationshipMode] = useState(null);
  const [relationshipStart, setRelationshipStart] = useState(null);
  const [showCode, setShowCode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [toast, setToast] = useState('');
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const selectionIsClass = selection.type === 'class';
  const selectedClass = selectionIsClass ? classes.find((item) => item.id === selection.id) : null;
  const selectedRelationship = selection.type === 'relationship'
    ? relationships.find((item) => item.id === selection.id)
    : null;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ classes, relationships }));
      setSaveStatus('Saved on this device');
    } catch (error) {
      console.error('Unable to save the UML diagram:', error);
      setSaveStatus('Save failed');
    }
  }, [classes, relationships]);

  const announce = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2500);
  };

  const addClass = () => {
    const id = `class-${Date.now()}`;
    const positions = [25, 315, 605, 895].flatMap((x) => [25, 255, 485].map((y) => ({ x, y })));
    const position = positions.find((candidate) => classes.every((item) => (
      candidate.x + CLASS_WIDTH + 24 <= item.x
      || item.x + CLASS_WIDTH + 24 <= candidate.x
      || candidate.y + 190 + 24 <= item.y
      || item.y + classHeight(item) + 24 <= candidate.y
    ))) ?? { x: 25 + (classes.length % 4) * 290, y: 25 + (classes.length % 3) * 230 };
    const newClass = {
      id,
      name: 'NewClass',
      ...position,
      attributes: ['- id: Long'],
      methods: ['+ newMethod(): void'],
    };
    setClasses((current) => [...current, newClass]);
    setSelection({ type: 'class', id });
    setRelationshipMode(null);
    announce('Class added to your diagram');
  };

  const updateSelectedClass = (changes) => {
    setClasses((current) => current.map((item) => item.id === selectedClass.id ? { ...item, ...changes } : item));
  };

  const deleteClass = (id) => {
    setClasses((current) => current.filter((item) => item.id !== id));
    setRelationships((current) => current.filter((item) => item.from !== id && item.to !== id));
    setSelection({ type: 'class', id: null });
    setRelationshipStart(null);
    announce('Class and its relationships removed');
  };

  const updateSelectedRelationship = (changes) => {
    setRelationships((current) => current.map((item) => item.id === selectedRelationship.id ? { ...item, ...changes } : item));
  };

  const deleteRelationship = (id) => {
    setRelationships((current) => current.filter((item) => item.id !== id));
    setSelection({ type: 'class', id: null });
    announce('Relationship removed');
  };

  const handleClassClick = (event, umlClass) => {
    event.stopPropagation();
    if (relationshipMode) {
      if (!relationshipStart) {
        setRelationshipStart(umlClass.id);
        setSelection({ type: 'class', id: umlClass.id });
        return;
      }
      if (relationshipStart === umlClass.id) {
        setRelationshipStart(null);
        return;
      }
      const exists = relationships.some((item) => item.from === relationshipStart && item.to === umlClass.id && item.type === relationshipMode);
      if (exists) {
        announce('That relationship already exists');
      } else {
        setRelationships((current) => [...current, {
          id: `relation-${Date.now()}`,
          from: relationshipStart,
          to: umlClass.id,
          type: relationshipMode,
          label: '',
        }]);
        setSelection({ type: 'class', id: null });
        announce(`${TYPE_META[relationshipMode].title} created`);
      }
      setRelationshipStart(null);
      setRelationshipMode(null);
      return;
    }
    setSelection({ type: 'class', id: umlClass.id });
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current || !svgRef.current) return;
    const point = svgRef.current.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const coordinates = point.matrixTransform(svgRef.current.getScreenCTM().inverse());
    const { id, offsetX, offsetY } = dragRef.current;
    setClasses((current) => current.map((item) => item.id === id ? {
      ...item,
      x: Math.max(12, Math.min(1160 - CLASS_WIDTH, coordinates.x - offsetX)),
      y: Math.max(12, Math.min(720 - classHeight(item), coordinates.y - offsetY)),
    } : item));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const resetDiagram = () => {
    setClasses(INITIAL_CLASSES);
    setRelationships(INITIAL_RELATIONSHIPS);
    setSelection({ type: 'class', id: 'customer' });
    setRelationshipMode(null);
    announce('Sample diagram restored');
  };

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        setShowCode(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const canvasLabel = relationshipMode
    ? relationshipStart ? 'Choose a class to connect to' : `Click a class to start ${TYPE_META[relationshipMode].title.toLowerCase()}`
    : 'Click a class to edit · drag to move';

  const zoomCanvas = (direction) => setZoom((current) => Math.max(0.65, Math.min(1.25, +(current + direction * 0.1).toFixed(2))));

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><BrandMark /><span className="brand-name">UML by Suyog</span><span className="brand-divider" /><span className="brand-section">Class diagram studio</span></div>
        <div className="topbar-right"><span className={`saved-indicator ${saveStatus === 'Save failed' ? 'save-failed' : ''}`}><span />{saveStatus}</span><button className="help-button" title="Drag classes to move them. Use relationship tools, then click two classes to connect them."><CircleHelp size={17} /><span>Help</span></button><button className="avatar" title="Your workspace">S</button></div>
      </header>
      <div className="projectbar">
        <div className="project-title"><span className="breadcrumb-muted">My projects</span><ChevronDown className="breadcrumb-arrow" size={13} /><span className="project-name">E-commerce platform</span><button className="tiny-menu" title="Project options"><Ellipsis size={18} /></button></div>
        <div className="project-actions"><span className="diagram-status"><span />Diagram</span><button className="export-button" onClick={() => setShowCode(true)}><Code2 size={16} /><span>Generate Java</span><span className="export-shortcut">Ctrl ↵</span></button></div>
      </div>
      <div className="workspace">
        <aside className="sidebar panel">
          <div className="sidebar-heading"><div><span className="eyebrow">WORKSPACE</span><h2>Class diagram</h2></div><button className="add-class-button" aria-label="Add class" title="Add class" onClick={addClass}><Plus size={17} /></button></div>
          <div className="sidebar-search"><span className="search-icon"><MousePointer2 size={14} /></span><span>Diagram elements</span><span className="element-count">{classes.length + relationships.length}</span></div>
          <div className="element-group"><span className="group-label">CLASSES</span><span className="group-count">{classes.length}</span></div>
          <div className="class-list">
            {classes.map((umlClass) => (
              <button key={umlClass.id} className={`class-list-item ${selection.type === 'class' && selection.id === umlClass.id ? 'active' : ''}`} onClick={() => {
                setSelection({ type: 'class', id: umlClass.id });
                setRelationshipMode(null);
                setRelationshipStart(null);
              }}>
                <span className="class-list-icon"><Braces size={15} /></span><span className="class-list-name">{umlClass.name || 'Untitled'}</span><span className="class-member-count">{umlClass.attributes.length}</span>
              </button>
            ))}
            <button className="add-class-row" onClick={addClass}><PlusCircle size={15} /> Add a class</button>
          </div>
          <div className="element-group relationship-group"><span className="group-label">RELATIONSHIPS</span><span className="group-count">{relationships.length}</span></div>
          <div className="relationship-list">
            {relationships.map((relationship) => {
              const Icon = TYPE_META[relationship.type].icon;
              const fromName = classes.find((item) => item.id === relationship.from)?.name || '?';
              const toName = classes.find((item) => item.id === relationship.to)?.name || '?';
              return (
                <button key={relationship.id} className={`relationship-list-item ${selection.id === relationship.id ? 'active' : ''}`} onClick={() => {
                  setSelection({ type: 'relationship', id: relationship.id });
                  setRelationshipMode(null);
                }}>
                  <span className={`relation-list-icon ${relationship.type}`}><Icon size={13} /></span><span><strong>{fromName}</strong><span className="relationship-list-label">{relationship.label || TYPE_META[relationship.type].title}</span><strong>{toName}</strong></span>
                </button>
              );
            })}
            {!relationships.length && <p className="no-relationships">No connections yet.</p>}
          </div>
          <div className="sidebar-bottom"><button onClick={resetDiagram}><RotateCcw size={15} />Reset sample diagram</button><span>UML 2.5</span></div>
        </aside>
        <section className="diagram-area" aria-label="UML class diagram editor">
          <div className="canvas-toolbar">
            <div className="tool-group"><button className="canvas-tool selected" title="Select and move"><MousePointer2 size={16} /></button><button className="canvas-tool" title="Pan canvas"><Hand size={16} /></button><span className="toolbar-separator" /><RelationshipToolbar activeRelationship={relationshipMode} onSelect={(type) => {
              setRelationshipMode(type);
              setRelationshipStart(null);
              setSelection({ type: 'class', id: null });
            }} /></div>
            <div className="toolbar-right"><span className="canvas-size">1200 × 720</span><span className="toolbar-separator" /><IconButton title="Zoom out" onClick={() => zoomCanvas(-1)}><Minus size={15} /></IconButton><span className="zoom-level">{Math.round(zoom * 100)}%</span><IconButton title="Zoom in" onClick={() => zoomCanvas(1)}><Plus size={15} /></IconButton></div>
          </div>
          <div className={`canvas-wrap ${relationshipMode ? 'connecting' : ''}`}>
            <div className="canvas-note"><span className={relationshipMode ? 'note-connecting' : ''}>{relationshipMode ? <Link2 size={14} /> : <Grip size={14} />}</span>{canvasLabel}</div>
            <div className="canvas-inner" style={{ transform: `scale(${zoom})` }}>
              <svg
                ref={svgRef}
                className="diagram-svg"
                viewBox="0 0 1200 720"
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onClick={() => {
                  if (!relationshipMode) setSelection({ type: 'class', id: null });
                }}
              >
                <defs>
                  <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r="1" fill="#dfe4eb" />
                  </pattern>
                </defs>
                <rect className="canvas-grid" width="1200" height="720" fill="url(#grid)" />
                {relationships.map((relationship) => (
                  <RelationshipLine
                    key={relationship.id}
                    relationship={relationship}
                    fromClass={classes.find((item) => item.id === relationship.from)}
                    toClass={classes.find((item) => item.id === relationship.to)}
                    isSelected={selection.type === 'relationship' && selection.id === relationship.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelection({ type: 'relationship', id: relationship.id });
                      setRelationshipMode(null);
                    }}
                  />
                ))}
                {classes.map((umlClass) => (
                  <ClassCard
                    key={umlClass.id}
                    umlClass={umlClass}
                    isSelected={selection.type === 'class' && selection.id === umlClass.id}
                    onPointerDown={(event) => {
                      if (relationshipMode || event.button !== 0) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const point = svgRef.current.createSVGPoint();
                      point.x = event.clientX;
                      point.y = event.clientY;
                      const coordinates = point.matrixTransform(svgRef.current.getScreenCTM().inverse());
                      dragRef.current = { id: umlClass.id, offsetX: coordinates.x - umlClass.x, offsetY: coordinates.y - umlClass.y };
                      event.currentTarget.setPointerCapture?.(event.pointerId);
                    }}
                    onClick={(event) => handleClassClick(event, umlClass)}
                    onDoubleClick={() => {
                      setSelection({ type: 'class', id: umlClass.id });
                      setShowCode(false);
                    }}
                    onDelete={() => deleteClass(umlClass.id)}
                  />
                ))}
              </svg>
            </div>
            {!classes.length && <div className="canvas-empty"><div><Braces size={24} /></div><h3>Your diagram starts here</h3><p>Add your first UML class to begin designing.</p><button onClick={addClass}><Plus size={15} />Add your first class</button></div>}
            <div className="canvas-footer"><span><span className="live-dot" />{classes.length} classes <span className="footer-dot">·</span> {relationships.length} relationships</span><span>Last edited just now</span></div>
          </div>
        </section>
        <Inspector
          selectedClass={selectedClass}
          selectedRelationship={selectedRelationship}
          updateClass={updateSelectedClass}
          updateRelationship={updateSelectedRelationship}
          onDeleteClass={() => selectedClass && deleteClass(selectedClass.id)}
          onDeleteRelationship={() => selectedRelationship && deleteRelationship(selectedRelationship.id)}
        />
      </div>
      {showCode && <CodeModal classes={classes} relationships={relationships} onClose={() => setShowCode(false)} />}
      {toast && <div className="toast"><Check size={15} />{toast}</div>}
      {relationshipMode && <div className="connection-hint"><span className="hint-pulse" />{relationshipStart ? 'Now choose the second class' : 'Choose the first class'}<button onClick={() => {
        setRelationshipMode(null);
        setRelationshipStart(null);
      }}><X size={14} />Cancel</button></div>}
      <footer className="app-footer"><span><BrandMark />Made for thoughtful modeling</span><span><span className="footer-key">Ctrl</span> <span className="footer-key">↵</span> Generate Java</span></footer>
    </main>
  );
}
