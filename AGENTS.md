# Project Architecture Rules

- Keep billing, freemium limits, and feature tools in focused modules so their rules can be tested independently and the existing scientific calculator remains unlimited.
- Grant subscription access only from purchases reported by the Google Play Digital Goods service; never unlock PRO through a browser-preview simulation because local-only proof is not trustworthy.