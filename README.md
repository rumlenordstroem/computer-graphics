# Computer graphics

You can set up the development environment using **Nix**.
If you already have NPM and a browser with WebGPU support you can skip this step.

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
