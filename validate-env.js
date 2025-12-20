#!/usr/bin/env node
/**
 * Environment Validation Script
 * Checks if all required environment variables are set before deployment
 */

const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, symbol, message) {
  console.log(`${color}${symbol}${colors.reset} ${message}`);
}

function success(message) {
  log(colors.green, '✓', message);
}

function error(message) {
  log(colors.red, '✗', message);
}

function warning(message) {
  log(colors.yellow, '⚠', message);
}

function info(message) {
  log(colors.cyan, 'ℹ', message);
}

// Required environment variables
const requiredVars = {
  'AmEx Gyftr': [
    { name: 'MOBILE', description: 'Your mobile number' },
    { name: 'EMAIL', description: 'Your email address' },
    { name: 'CARD_CVV', description: 'Card CVV' },
  ],
  'n8n Configuration': [
    { name: 'N8N_HOST', description: 'n8n host domain' },
    { name: 'N8N_BASE_URL', description: 'n8n base URL' },
    { name: 'N8N_PORT', description: 'n8n port', default: '5678' },
  ],
};

// Optional but recommended variables
const optionalVars = {
  'Swiggy Auto-Claim': [
    { name: 'SWIGGY_VOUCHER_CLAIM_URL', description: 'Swiggy API endpoint' },
    { name: 'SWIGGY_DEVICE_ID', description: 'Swiggy device ID' },
    { name: 'SWIGGY_TID', description: 'Swiggy TID' },
    { name: 'SWIGGY_TOKEN', description: 'Swiggy auth token' },
  ],
  'Gold Charge Card': [
    { name: 'GOLD_CHARGE_CVV', description: 'Gold Charge card CVV' },
    { name: 'GOLD_CHARGE', description: 'Use Gold Charge card', default: 'false' },
  ],
};

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    warning('.env file not found - using system environment variables only');
    return process.env;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = { ...process.env };
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  return env;
}

function validateEnv(env) {
  let hasErrors = false;
  let warnings = 0;
  
  console.log('\n' + colors.cyan + '═'.repeat(60) + colors.reset);
  console.log(colors.cyan + '  Environment Variables Validation' + colors.reset);
  console.log(colors.cyan + '═'.repeat(60) + colors.reset + '\n');
  
  // Check required variables
  for (const [category, vars] of Object.entries(requiredVars)) {
    console.log(colors.blue + `\n${category}:` + colors.reset);
    
    vars.forEach(({ name, description, default: defaultValue }) => {
      const value = env[name];
      
      if (!value || value === '' || value === 'your_mobile_number' || value === 'your_email@example.com') {
        if (defaultValue) {
          warning(`${name}: Using default value "${defaultValue}"`);
        } else {
          error(`${name}: Missing! (${description})`);
          hasErrors = true;
        }
      } else {
        success(`${name}: Set ✓`);
      }
    });
  }
  
  // Check optional variables
  for (const [category, vars] of Object.entries(optionalVars)) {
    console.log(colors.blue + `\n${category} (Optional):` + colors.reset);
    
    vars.forEach(({ name, description, default: defaultValue }) => {
      const value = env[name];
      
      if (!value || value === '') {
        if (defaultValue) {
          info(`${name}: Using default "${defaultValue}"`);
        } else {
          warning(`${name}: Not set (${description})`);
          warnings++;
        }
      } else {
        success(`${name}: Set ✓`);
      }
    });
  }
  
  // Summary
  console.log('\n' + colors.cyan + '═'.repeat(60) + colors.reset);
  console.log(colors.cyan + '  Validation Summary' + colors.reset);
  console.log(colors.cyan + '═'.repeat(60) + colors.reset + '\n');
  
  if (hasErrors) {
    error(`Validation FAILED: Missing required environment variables`);
    console.log('\n' + colors.yellow + 'Fix these issues before deployment:' + colors.reset);
    console.log('1. Copy example.env to .env');
    console.log('2. Fill in all required values');
    console.log('3. Run this script again to validate\n');
    process.exit(1);
  } else if (warnings > 0) {
    warning(`Validation PASSED with ${warnings} warning(s)`);
    console.log('\n' + colors.yellow + 'Optional features may not work without these variables:' + colors.reset);
    console.log('- Swiggy auto-claim requires SWIGGY_* variables');
    console.log('- Gold Charge card requires GOLD_CHARGE_CVV\n');
    process.exit(0);
  } else {
    success('Validation PASSED! All required variables are set ✓');
    console.log('\n' + colors.green + 'Ready for deployment!' + colors.reset + '\n');
    process.exit(0);
  }
}

// Run validation
try {
  const env = loadEnv();
  validateEnv(env);
} catch (err) {
  error(`Validation error: ${err.message}`);
  process.exit(1);
}





