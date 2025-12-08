{
  description = "A Nix Flake providing a development environment for computer graphics";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        packages = with pkgs; [
          chromium
          typescript
          typescript-language-server
          nodejs_24
          (python3.withPackages (python-pkgs: with python-pkgs; [
          ]))
        ];
      in {
        devShells = {
          default = pkgs.mkShell { name = "graphics"; inherit packages; };
        };
      });
}
