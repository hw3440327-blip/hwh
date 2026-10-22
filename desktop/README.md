# Portable Windows desktop shell

The shell embeds only the verified `release/web-build-v4.2.0.json` allowlist. It
binds `127.0.0.1:19842`, starts installed Edge (or Chrome) in application mode,
and keeps a dedicated profile in `%LOCALAPPDATA%\NextSpringDesktop\profile`.
The fixed origin retains saves between launches and future compatible versions.
It does not read the normal browser profile, install services, or disable the
browser sandbox. Closing the dedicated browser process stops the local server.

`python scripts/package-desktop.py --prepare` stages the exact production assets.
Use an official Go 1.23+ toolchain to test and build, with `CGO_ENABLED=0` and
`GOOS=windows GOARCH=amd64`. The Windows build uses `-H=windowsgui`.
`python scripts/package-desktop.py --package` verifies the PE target and packages
the executable, source notices, and user instructions. It never edits the game.

Validation uses a Linux build of the same embedded server with `--serve-only`.
`--verify-assets` independently checks every embedded byte against its manifest.
Linux validation does not establish that the Windows GUI launch was executed.
