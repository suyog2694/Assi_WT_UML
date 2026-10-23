# Software Requirements

## Project

**UML by Suyog — Class Diagram Studio**

## Objectives

1. Develop a responsive web application for creating and managing UML class diagrams.
2. Allow users to add, edit, and delete classes, attributes, methods, and class relationships.
3. Visually represent classes and association, inheritance, and dependency relationships, with support for moving classes around the diagram.
4. Generate Java source code from the designed class diagram and allow users to copy or download the generated files.

## Software Requirements

### Software needed

- **Operating system:** Windows, macOS, or Linux.
- **Node.js:** Install the current LTS version to run the project.
- **npm:** Comes with Node.js. It installs the project packages and runs project commands.
- **Code editor:** Visual Studio Code or another editor can be used to view and edit the source code.
- **Web browser:** Use a modern browser such as Chrome, Edge, Firefox, or Safari to open the app.

### Technologies used

- **React:** Builds the app's reusable interface components.
- **JavaScript:** Runs the app, handles diagram changes, and generates Java source code.
- **HTML:** Provides the app's web page structure.
- **CSS:** Controls the look of the app and helps it fit different screen sizes.
- **SVG:** Draws the UML classes, connections, and diagram canvas.
- **Vite:** Starts the local development server and builds the app.
- **Lucide React:** Provides icons used in the interface.
- **Browser local storage:** Saves the diagram in the browser on the user's device.
- **Node.js test runner:** Runs tests for Java code generation and ZIP export.

## Run the application

From the project folder, open a terminal and run:

```sh
npm install
npm run dev
```

```sh
npm run build
npm test
```

- To build the app for production, run `npm run build`.
- To run the tests, run `npm test`.

The app can generate Java source code without installing Java. Install a Java Development Kit (JDK) only if you also want to compile the generated code.
