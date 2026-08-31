export class WorkflowError extends Error {
  readonly code: string;

  constructor(message: string, code = "WORKFLOW_ERROR") {
    super(message);
    this.name = "WorkflowError";
    this.code = code;
  }
}

export class ValidationError extends WorkflowError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class TransitionError extends WorkflowError {
  constructor(message: string) {
    super(message, "INVALID_TRANSITION");
    this.name = "TransitionError";
  }
}
