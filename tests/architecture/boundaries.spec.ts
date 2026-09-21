import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function getAllTsFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.next') {
        results = results.concat(getAllTsFiles(filePath));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(filePath);
    }
  }
  return results;
}

describe('Architectural Boundary Enforcement (Acceptance Criterion 7)', () => {
  const rootDir = process.cwd();

  it('packages/calculation-engine does not import React, Nest, Fastify, Drizzle, ORM, or providers', () => {
    const files = getAllTsFiles(path.join(rootDir, 'packages/calculation-engine/src'));
    expect(files.length).toBeGreaterThan(0);

    const forbidden = ['@nestjs', 'react', 'next', 'fastify', 'drizzle', 'pg'];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbidden) {
        expect(content, `File ${file} imports forbidden pattern: ${pattern}`).not.toContain(pattern);
      }
    }
  });

  it('packages/contracts does not import UI, transport or framework runtime dependencies', () => {
    const files = getAllTsFiles(path.join(rootDir, 'packages/contracts/src'));
    expect(files.length).toBeGreaterThan(0);

    const forbidden = ['@nestjs', 'react', 'next', 'fastify', 'drizzle'];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbidden) {
        expect(content, `File ${file} imports forbidden pattern: ${pattern}`).not.toContain(pattern);
      }
    }
  });

  it('apps/web does not import internal source paths from apps/api', () => {
    const files = getAllTsFiles(path.join(rootDir, 'apps/web'));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from\s+['"].*apps\/api\/src/);
      expect(content).not.toMatch(/from\s+['"]\.\.\/\.\.\/apps\/api/);
    }
  });

  it('shared packages define strict export maps that block internal deep imports', () => {
    const contractsPkg = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'packages/contracts/package.json'), 'utf-8'),
    );
    const calcPkg = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'packages/calculation-engine/package.json'), 'utf-8'),
    );

    // Only root '.' export is permitted, no wildcard internal subpath exports
    expect(contractsPkg.exports).toBeDefined();
    expect(Object.keys(contractsPkg.exports)).toEqual(['.']);

    expect(calcPkg.exports).toBeDefined();
    expect(Object.keys(calcPkg.exports)).toEqual(['.']);
  });
});
