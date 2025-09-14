interface FormulaContext {
  assignments: number;
  exam: number;
  [key: string]: number;
}

export class FormulaEvaluator {
  static evaluate(formula: string, context: FormulaContext): number {
    try {
      // Replace variable names with their values from the context
      let expression = formula.replace(/assignments/g, String(context.assignments))
                              .replace(/exam/g, String(context.exam));

      // Basic validation for allowed characters (numbers, operators, parentheses)
      if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
        throw new Error('Invalid characters in formula');
      }

      // Using Function constructor for safe evaluation
      return new Function(`return ${expression}`)();
    } catch (error) {
      console.error(`Error evaluating formula: ${formula}`, error);
      // Return a default or error value
      return 0;
    }
  }
}
