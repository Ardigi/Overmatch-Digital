export class CronJob {
  start = jest.fn();
  stop = jest.fn();
  nextDates = jest.fn(() => [new Date()]);
  fireOnTick = jest.fn();
  addCallback = jest.fn();
  setTime = jest.fn();
  lastDate = jest.fn(() => new Date());
  running = false;

  constructor(
    private cronTime: string | Date,
    private onTick: Function,
    private onComplete?: Function,
    private shouldStart?: boolean,
    private timezone?: string,
    private context?: any,
    private runOnInit?: boolean
  ) {
    if (shouldStart) {
      this.start();
    }
  }
}

export const CronTime = jest.fn();

export default {
  CronJob,
  CronTime,
};
