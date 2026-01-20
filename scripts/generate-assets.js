#!/usr/bin/env node

/**
 * Asset Generation Script using Gemini API
 * This script generates Spring Festival themed game assets
 * 
 * Usage: node generate-assets.js [API_KEY]
 * 
 * Note: This is a template script. To use it:
 * 1. Get a Gemini API key from Google AI Studio
 * 2. Run: node generate-assets.js YOUR_API_KEY
 * 3. Generated images will be described and can be created using the API
 */

const fs = require('fs');
const path = require('path');

const API_KEY = process.argv[2] || process.env.GEMINI_API_KEY;

const ASSET_DESCRIPTIONS = {
  base: 'A Chinese New Year themed fortress base building, isometric pixel art style, red and gold colors, with lanterns and decorations',
  tower: 'A defensive tower with Spring Festival decorations, isometric pixel art, red walls with golden roof, firecrackers hanging',
  barracks: 'A military barracks building with Chinese New Year theme, isometric view, traditional architecture',
  collector: 'A small character unit carrying New Year goods, cute pixel art style, isometric view',
  firecracker_soldier: 'A soldier character holding firecrackers as weapons, Spring Festival theme, pixel art, isometric view',
  nian_beast: 'A mythical Nian beast character, Chinese New Year monster, pixel art style, isometric perspective',
  resource: 'Chinese New Year goods and gifts, colorful packages, pixel art icon, isometric view'
};

async function generateAssetPrompts() {
  console.log('=== Spring Festival Battle Asset Generation ===\n');
  
  if (!API_KEY) {
    console.log('⚠️  No API key provided. This script shows what would be generated.\n');
  }

  console.log('Asset prompts for image generation:\n');

  for (const [name, description] of Object.entries(ASSET_DESCRIPTIONS)) {
    console.log(`\n📦 ${name.toUpperCase()}`);
    console.log(`   Prompt: "${description}"`);
    console.log(`   Output: assets/${name}.png`);
  }

  // Create assets directory
  const assetsDir = path.join(__dirname, '../public/assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Create placeholder info file
  const readmePath = path.join(assetsDir, 'README.md');
  const readmeContent = `# Game Assets

This directory contains game assets for Spring Festival Battle.

## Asset Generation

To generate assets using Gemini API:

1. Get an API key from Google AI Studio: https://makersuite.google.com/app/apikey
2. Run the generation script:
   \`\`\`
   node scripts/generate-assets.js YOUR_API_KEY
   \`\`\`

## Asset List

${Object.entries(ASSET_DESCRIPTIONS).map(([name, desc]) => 
  `- **${name}.png**: ${desc}`
).join('\n')}

## Placeholder Assets

Currently using geometric shapes as placeholders in the Three.js renderer.
Replace these with actual sprite images for better visuals.

## Spritesheet Generation

For animated sprites, use spritesmith:
\`\`\`
npm install --save-dev spritesmith
\`\`\`

Then configure a build task to combine animation frames into spritesheets.
`;

  fs.writeFileSync(readmePath, readmeContent);
  console.log(`\n✅ Created asset documentation at ${readmePath}`);

  console.log('\n💡 Tips:');
  console.log('   - Use the prompts above with any AI image generator');
  console.log('   - Recommended size: 256x256 pixels per asset');
  console.log('   - Use pixel art style for retro RTS feel');
  console.log('   - Create multiple frames for unit animations');
  console.log('   - Use spritesmith to combine frames into spritesheets\n');
}

// Run the script
generateAssetPrompts().catch(console.error);
