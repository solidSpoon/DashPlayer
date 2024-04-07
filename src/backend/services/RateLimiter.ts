import DpTaskService from '@/backend/services/DpTaskService';
import { DpTaskState } from '@/backend/db/tables/dpTask';

class RateLimiter {
  private lastTimestamp = 0;
  private counter = 0;
  private limit = 10;

  async limitRate(taskId: number) {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp === this.lastTimestamp) {
      this.counter++;
      if (this.counter > this.limit) {
        await DpTaskService.update({
          id: taskId,
          status: DpTaskState.FAILED,
          progress: 'Rate limit exceeded'
        });
        console.log('Rate limit exceeded');
        return false;
      }
    } else {
      this.lastTimestamp = currentTimestamp;
      this.counter = 1;
    }
    return true;
  }
}

export default RateLimiter;
