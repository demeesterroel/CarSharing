#!/usr/bin/env node

// Codemod script to migrate paper tokens to semantic names and replace hardcoded colors
// This script demonstrates the approach for bulk updates

const fs = require('fs');
const path = require('path');

// Define the mapping for paper tokens to semantic names
const tokenMapping = {
  'paper.paper': 'paper.background.primary',
  'paper.paperDeep': 'paper.background.secondary',
  'paper.paperDark': 'paper.background.tertiary',
  'paper.ink': 'paper.text.primary',
  'paper.inkDim': 'paper.text.secondary',
  'paper.inkMute': 'paper.text.tertiary',
  'paper.accent': 'paper.accent.primary',
  'paper.green': 'paper.accent.success',
  'paper.blue': 'paper.accent.info',
  'paper.amber': 'paper.accent.warning'
};

// Define hardcoded color replacements
const colorReplacements = {
  '"#fff"': 'paper.text.primary',
  '"#c0392b"': 'paper.accent.primary', // Red error color
  '"#8a6d3b"': 'paper.text.secondary', // Brown text
  '"#fcf3e3"': 'paper.background.secondary', // Light yellow background
  '"#e8d9b5"': 'paper.background.tertiary', // Tan border
  '"#b45309"': 'paper.accent.warning', // Orange color
  '"#fffbeb"': 'paper.background.secondary', // Cream background
  '"#fde68a"': 'paper.accent.warning', // Yellow border
  '"#2d7a2d"': 'paper.accent.success' // Green success
};

// Simple function to process files for token replacement
function processFile(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) {
    return;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // Apply token replacements
    Object.entries(tokenMapping).forEach(([oldToken, newToken]) => {
      const regex = new RegExp(oldToken, 'g');
      content = content.replace(regex, newToken);
    });

    // Apply color replacements  
    Object.entries(colorReplacements).forEach(([oldColor, newToken]) => {
      const regex = new RegExp(oldColor, 'g');
      content = content.replace(regex, newToken);
    });

    // If content changed, write back to file
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Walk through directory and process files
function walkDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDirectory(filePath);
    } else if (stat.isFile() && (file.endsWith('.tsx') || file.endsWith('.ts'))) {
      processFile(filePath);
    }
  });
}

// Main execution
if (require.main === module) {
  const targetDirectory = process.argv[2] || '.';
  console.log(`Processing files in: ${targetDirectory}`);
  walkDirectory(targetDirectory);
  console.log('Codemod processing complete.');
}

module.exports = { processFile, walkDirectory, tokenMapping, colorReplacements };