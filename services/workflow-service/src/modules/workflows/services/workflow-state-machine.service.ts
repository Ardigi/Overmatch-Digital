import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InstanceStatus } from '../entities/workflow-instance.entity';
import { ExecutionStatus } from '../entities/workflow-step-execution.entity';

export enum StateTransitionEvent {
  START = 'START',
  COMPLETE_STEP = 'COMPLETE_STEP',
  FAIL_STEP = 'FAIL_STEP',
  SKIP_STEP = 'SKIP_STEP',
  PAUSE = 'PAUSE',
  RESUME = 'RESUME',
  CANCEL = 'CANCEL',
  TIMEOUT = 'TIMEOUT',
  RETRY = 'RETRY',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  ROLLBACK = 'ROLLBACK',
}

export interface StateTransition {
  from: InstanceStatus | ExecutionStatus;
  to: InstanceStatus | ExecutionStatus;
  event: StateTransitionEvent;
  condition?: (context: StateContext) => boolean;
  action?: (context: StateContext) => Promise<void>;
  guards?: Array<(context: StateContext) => boolean>;
}

export interface StateContext {
  instanceId: string;
  currentState: InstanceStatus | ExecutionStatus;
  previousState?: InstanceStatus | ExecutionStatus;
  event: StateTransitionEvent;
  metadata?: Record<string, any>;
  userId?: string;
  reason?: string;
  error?: Error;
}

export interface StateMachineConfig {
  states: Set<InstanceStatus | ExecutionStatus>;
  initialState: InstanceStatus | ExecutionStatus;
  finalStates: Set<InstanceStatus | ExecutionStatus>;
  transitions: StateTransition[];
}

@Injectable()
export class WorkflowStateMachineService {
  private readonly logger = new Logger(WorkflowStateMachineService.name);
  
  // Workflow instance state machine configuration
  private readonly instanceStateMachine: StateMachineConfig = {
    states: new Set([
      InstanceStatus.PENDING,
      InstanceStatus.RUNNING,
      InstanceStatus.PAUSED,
      InstanceStatus.COMPLETED,
      InstanceStatus.FAILED,
      InstanceStatus.CANCELLED,
      InstanceStatus.TIMEOUT,
    ]),
    initialState: InstanceStatus.PENDING,
    finalStates: new Set([
      InstanceStatus.COMPLETED,
      InstanceStatus.FAILED,
      InstanceStatus.CANCELLED,
      InstanceStatus.TIMEOUT,
    ]),
    transitions: [
      // Start workflow
      {
        from: InstanceStatus.PENDING,
        to: InstanceStatus.RUNNING,
        event: StateTransitionEvent.START,
      },
      // Pause workflow
      {
        from: InstanceStatus.RUNNING,
        to: InstanceStatus.PAUSED,
        event: StateTransitionEvent.PAUSE,
        guards: [(ctx) => !this.hasCriticalStepsRunning(ctx)],
      },
      // Resume workflow
      {
        from: InstanceStatus.PAUSED,
        to: InstanceStatus.RUNNING,
        event: StateTransitionEvent.RESUME,
      },
      // Complete workflow
      {
        from: InstanceStatus.RUNNING,
        to: InstanceStatus.COMPLETED,
        event: StateTransitionEvent.COMPLETE_STEP,
        condition: (ctx) => this.areAllStepsCompleted(ctx),
      },
      // Fail workflow
      {
        from: InstanceStatus.RUNNING,
        to: InstanceStatus.FAILED,
        event: StateTransitionEvent.FAIL_STEP,
        condition: (ctx) => !this.canRetry(ctx),
      },
      // Cancel workflow
      {
        from: InstanceStatus.RUNNING,
        to: InstanceStatus.CANCELLED,
        event: StateTransitionEvent.CANCEL,
      },
      {
        from: InstanceStatus.PAUSED,
        to: InstanceStatus.CANCELLED,
        event: StateTransitionEvent.CANCEL,
      },
      {
        from: InstanceStatus.PENDING,
        to: InstanceStatus.CANCELLED,
        event: StateTransitionEvent.CANCEL,
      },
      // Timeout workflow
      {
        from: InstanceStatus.RUNNING,
        to: InstanceStatus.TIMEOUT,
        event: StateTransitionEvent.TIMEOUT,
      },
      {
        from: InstanceStatus.PAUSED,
        to: InstanceStatus.TIMEOUT,
        event: StateTransitionEvent.TIMEOUT,
      },
    ],
  };

  // Step execution state machine configuration
  private readonly stepStateMachine: StateMachineConfig = {
    states: new Set([
      ExecutionStatus.PENDING,
      ExecutionStatus.RUNNING,
      ExecutionStatus.WAITING_APPROVAL,
      ExecutionStatus.COMPLETED,
      ExecutionStatus.FAILED,
      ExecutionStatus.SKIPPED,
      ExecutionStatus.CANCELLED,
      ExecutionStatus.TIMEOUT,
    ]),
    initialState: ExecutionStatus.PENDING,
    finalStates: new Set([
      ExecutionStatus.COMPLETED,
      ExecutionStatus.FAILED,
      ExecutionStatus.SKIPPED,
      ExecutionStatus.CANCELLED,
      ExecutionStatus.TIMEOUT,
    ]),
    transitions: [
      // Start step execution
      {
        from: ExecutionStatus.PENDING,
        to: ExecutionStatus.RUNNING,
        event: StateTransitionEvent.START,
      },
      // Step needs approval or external input
      {
        from: ExecutionStatus.RUNNING,
        to: ExecutionStatus.WAITING_APPROVAL,
        event: StateTransitionEvent.PAUSE,
      },
      // Resume from waiting
      {
        from: ExecutionStatus.WAITING_APPROVAL,
        to: ExecutionStatus.RUNNING,
        event: StateTransitionEvent.RESUME,
      },
      // Approve step (from waiting)
      {
        from: ExecutionStatus.WAITING_APPROVAL,
        to: ExecutionStatus.COMPLETED,
        event: StateTransitionEvent.APPROVE,
      },
      // Reject step (from waiting)
      {
        from: ExecutionStatus.WAITING_APPROVAL,
        to: ExecutionStatus.FAILED,
        event: StateTransitionEvent.REJECT,
      },
      // Complete step
      {
        from: ExecutionStatus.RUNNING,
        to: ExecutionStatus.COMPLETED,
        event: StateTransitionEvent.COMPLETE_STEP,
      },
      // Fail step
      {
        from: ExecutionStatus.RUNNING,
        to: ExecutionStatus.FAILED,
        event: StateTransitionEvent.FAIL_STEP,
      },
      // Skip step
      {
        from: ExecutionStatus.PENDING,
        to: ExecutionStatus.SKIPPED,
        event: StateTransitionEvent.SKIP_STEP,
      },
      {
        from: ExecutionStatus.RUNNING,
        to: ExecutionStatus.SKIPPED,
        event: StateTransitionEvent.SKIP_STEP,
      },
      // Cancel step
      {
        from: ExecutionStatus.PENDING,
        to: ExecutionStatus.CANCELLED,
        event: StateTransitionEvent.CANCEL,
      },
      {
        from: ExecutionStatus.RUNNING,
        to: ExecutionStatus.CANCELLED,
        event: StateTransitionEvent.CANCEL,
      },
      {
        from: ExecutionStatus.WAITING_APPROVAL,
        to: ExecutionStatus.CANCELLED,
        event: StateTransitionEvent.CANCEL,
      },
      // Timeout step
      {
        from: ExecutionStatus.RUNNING,
        to: ExecutionStatus.TIMEOUT,
        event: StateTransitionEvent.TIMEOUT,
      },
      {
        from: ExecutionStatus.WAITING_APPROVAL,
        to: ExecutionStatus.TIMEOUT,
        event: StateTransitionEvent.TIMEOUT,
      },
      // Retry failed step
      {
        from: ExecutionStatus.FAILED,
        to: ExecutionStatus.PENDING,
        event: StateTransitionEvent.RETRY,
        guards: [(ctx) => this.canRetry(ctx)],
      },
    ],
  };

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Validate if a state transition is allowed
   */
  canTransition(
    machine: 'instance' | 'step',
    from: InstanceStatus | ExecutionStatus,
    event: StateTransitionEvent,
    context?: Partial<StateContext>
  ): boolean {
    const stateMachine = machine === 'instance' ? this.instanceStateMachine : this.stepStateMachine;
    
    const transition = stateMachine.transitions.find(
      t => t.from === from && t.event === event
    );

    if (!transition) {
      return false;
    }

    // Check guards
    if (transition.guards) {
      const fullContext: StateContext = {
        instanceId: context?.instanceId || '',
        currentState: from,
        event,
        ...context,
      };
      
      return transition.guards.every(guard => guard(fullContext));
    }

    // Check condition
    if (transition.condition && context) {
      const fullContext: StateContext = {
        instanceId: context.instanceId || '',
        currentState: from,
        event,
        ...context,
      };
      
      return transition.condition(fullContext);
    }

    return true;
  }

  /**
   * Get next state for a given transition
   */
  getNextState(
    machine: 'instance' | 'step',
    from: InstanceStatus | ExecutionStatus,
    event: StateTransitionEvent
  ): InstanceStatus | ExecutionStatus | null {
    const stateMachine = machine === 'instance' ? this.instanceStateMachine : this.stepStateMachine;
    
    const transition = stateMachine.transitions.find(
      t => t.from === from && t.event === event
    );

    return transition ? transition.to : null;
  }

  /**
   * Execute a state transition
   */
  async executeTransition(
    machine: 'instance' | 'step',
    context: StateContext
  ): Promise<InstanceStatus | ExecutionStatus> {
    const stateMachine = machine === 'instance' ? this.instanceStateMachine : this.stepStateMachine;
    
    const transition = stateMachine.transitions.find(
      t => t.from === context.currentState && t.event === context.event
    );

    if (!transition) {
      throw new Error(
        `Invalid transition: ${context.currentState} -> ${context.event}`
      );
    }

    // Execute transition action if defined
    if (transition.action) {
      await transition.action(context);
    }

    // Emit transition event
    this.eventEmitter.emit(`workflow.${machine}.transition`, {
      instanceId: context.instanceId,
      from: context.currentState,
      to: transition.to,
      event: context.event,
      metadata: context.metadata,
    });

    this.logger.log(
      `State transition: ${machine} ${context.currentState} -> ${transition.to} (${context.event})`
    );

    return transition.to;
  }

  /**
   * Check if state is terminal
   */
  isTerminalState(
    machine: 'instance' | 'step',
    state: InstanceStatus | ExecutionStatus
  ): boolean {
    const stateMachine = machine === 'instance' ? this.instanceStateMachine : this.stepStateMachine;
    return stateMachine.finalStates.has(state);
  }

  /**
   * Get available transitions from current state
   */
  getAvailableTransitions(
    machine: 'instance' | 'step',
    currentState: InstanceStatus | ExecutionStatus
  ): StateTransitionEvent[] {
    const stateMachine = machine === 'instance' ? this.instanceStateMachine : this.stepStateMachine;
    
    return stateMachine.transitions
      .filter(t => t.from === currentState)
      .map(t => t.event);
  }

  /**
   * Validate state machine configuration
   */
  validateStateMachine(machine: 'instance' | 'step'): boolean {
    const stateMachine = machine === 'instance' ? this.instanceStateMachine : this.stepStateMachine;
    
    // Check all transition states are defined
    for (const transition of stateMachine.transitions) {
      if (!stateMachine.states.has(transition.from)) {
        this.logger.error(`Invalid from state: ${transition.from}`);
        return false;
      }
      if (!stateMachine.states.has(transition.to)) {
        this.logger.error(`Invalid to state: ${transition.to}`);
        return false;
      }
    }

    // Check initial state is defined
    if (!stateMachine.states.has(stateMachine.initialState)) {
      this.logger.error(`Invalid initial state: ${stateMachine.initialState}`);
      return false;
    }

    // Check final states are defined
    for (const finalState of stateMachine.finalStates) {
      if (!stateMachine.states.has(finalState)) {
        this.logger.error(`Invalid final state: ${finalState}`);
        return false;
      }
    }

    return true;
  }

  // Helper methods for conditions and guards
  private areAllStepsCompleted(context: StateContext): boolean {
    // This would check if all workflow steps are completed
    // Implementation depends on your workflow structure
    return context.metadata?.allStepsCompleted === true;
  }

  private hasCriticalStepsRunning(context: StateContext): boolean {
    // Check if any critical steps are currently running
    return context.metadata?.criticalStepsRunning === true;
  }

  private canRetry(context: StateContext): boolean {
    // Check if retry is allowed based on retry count and configuration
    const retryCount = context.metadata?.retryCount || 0;
    const maxRetries = context.metadata?.maxRetries || 3;
    return retryCount < maxRetries;
  }

  /**
   * Generate state diagram (for documentation/visualization)
   */
  generateStateDiagram(machine: 'instance' | 'step'): string {
    const stateMachine = machine === 'instance' ? this.instanceStateMachine : this.stepStateMachine;
    
    let diagram = 'stateDiagram-v2\n';
    
    // Add states
    for (const state of stateMachine.states) {
      diagram += `    ${state}\n`;
    }
    
    // Add transitions
    for (const transition of stateMachine.transitions) {
      diagram += `    ${transition.from} --> ${transition.to} : ${transition.event}\n`;
    }
    
    // Mark initial and final states
    diagram += `    [*] --> ${stateMachine.initialState}\n`;
    for (const finalState of stateMachine.finalStates) {
      diagram += `    ${finalState} --> [*]\n`;
    }
    
    return diagram;
  }
}