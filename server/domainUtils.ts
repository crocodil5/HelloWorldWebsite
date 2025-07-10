import { readFileSync } from 'fs';
import path from 'path';

/**
 * Reads domain from domain.config file in project root
 */
export function getDomainFromConfig(): string {
  try {
    const configPath = path.join(process.cwd(), 'domain.config');
    const domain = readFileSync(configPath, 'utf8').trim();
    console.log(`📁 Domain from config file: ${domain}`);
    return domain;
  } catch (error) {
    console.error('Error reading domain.config:', error);
    return 'pypal.link'; // fallback
  }
}