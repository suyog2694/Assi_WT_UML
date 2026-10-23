# UML by Suyog — Class Diagram Studio

A responsive React app for creating UML class diagrams and generating Java source files.

## Run locally

```sh
npm install
npm run dev
```

Build a production version with `npm run build`.
Run the Java generation tests with `npm test`.

## Screenshots

### Diagram editor

![UML diagram editor](./screenshots/Screenshot%202026-10-23%20190836.png)

### Java source preview

![Generated Java source preview](./screenshots/Screenshot%202026-10-23%20190850.png)

## Using the editor

- Add classes with the **+** button in the class list. Select a class to edit its name, attributes, and methods in the properties panel.
- Enter attributes as `- name: Type` and methods as `+ methodName(): ReturnType`. Use `+` for public and `-` for private visibility.
- Drag classes on the canvas to arrange the diagram. Select and delete a class from the properties panel or the selected class card.
- Choose **Association**, **Inheritance**, or **Dependency**, then click two classes to connect them. For inheritance, select the child class first and the parent class second. Select a relationship to edit its label or delete it.
- Select **Generate Java** to preview each generated class. Copy the selected file or download all generated Java files in a ZIP archive.
- Use **Reset sample diagram** to restore the starting example.

The diagram is saved in this browser on this device. Java output uses a default constructor policy (the Java compiler supplies one when needed), respects member visibility, maps associations to reference fields (`*` multiplicities use `List`), marks dependencies with comments, and applies inheritance with `extends`. For a field, use `fieldName: Type`; for a method parameter, use `parameterName: Type`.
