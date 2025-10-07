declare module 'safe-eval' {
  function safeEval(code: string, context?: Record<string, unknown>): unknown;
  export = safeEval;
}