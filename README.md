# Computer graphics

You can set up the development environment using **Nix** (recommended) or by manually installing dependencies.
This project uses the [Nix](https://github.com/NixOS/nix) package manager. This guarantees that all tools are installed with the correct versions.

To enter the development environment:
```bash
nix develop
```

Install the node packages with:
```bash
npm install
```

You can now start the webserver by running:
```bash
npm run dev
```

And open the start page:
```bash
chromium http://localhost:5173/
```
