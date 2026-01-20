# Game Assets

This directory contains game assets for Spring Festival Battle.

## Asset Generation

To generate assets using Gemini API:

1. Get an API key from Google AI Studio: https://makersuite.google.com/app/apikey
2. Run the generation script:
   ```
   node scripts/generate-assets.js YOUR_API_KEY
   ```

## Asset List

- **base.png**: A Chinese New Year themed fortress base building, isometric pixel art style, red and gold colors, with lanterns and decorations
- **tower.png**: A defensive tower with Spring Festival decorations, isometric pixel art, red walls with golden roof, firecrackers hanging
- **barracks.png**: A military barracks building with Chinese New Year theme, isometric view, traditional architecture
- **collector.png**: A small character unit carrying New Year goods, cute pixel art style, isometric view
- **firecracker_soldier.png**: A soldier character holding firecrackers as weapons, Spring Festival theme, pixel art, isometric view
- **nian_beast.png**: A mythical Nian beast character, Chinese New Year monster, pixel art style, isometric perspective
- **resource.png**: Chinese New Year goods and gifts, colorful packages, pixel art icon, isometric view

## Placeholder Assets

Currently using geometric shapes as placeholders in the Three.js renderer.
Replace these with actual sprite images for better visuals.

## Spritesheet Generation

For animated sprites, use spritesmith:
```
npm install --save-dev spritesmith
```

Then configure a build task to combine animation frames into spritesheets.
