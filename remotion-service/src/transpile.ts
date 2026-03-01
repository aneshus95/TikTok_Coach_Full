import {transform} from 'esbuild';

/**
 * Transpiles Gemini-generated TSX code to plain JavaScript.
 * - Strips TypeScript type annotations
 * - Converts JSX to React.createElement() calls (classic mode)
 * - Strips export keywords (code must define Effect as a const)
 * - ~10ms per transpilation
 */
export async function transpileTSX(tsxCode: string): Promise<string> {
  const result = await transform(tsxCode, {
    loader: 'tsx',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    target: 'es2020',
    // Don't minify — keep readable for debugging
    minify: false,
  });

  let code = result.code;

  // Strip export statements (Gemini might add them despite instructions)
  // "export default " → ""
  // "export const " → "const "
  // "export function " → "function "
  code = code.replace(/export\s+default\s+/g, '');
  code = code.replace(/export\s+(?=const |function |class )/g, '');

  return code;
}
