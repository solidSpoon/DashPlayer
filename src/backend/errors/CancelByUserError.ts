import ErrorConstants from '@/common/constants/error-constants';
import StrUtil from '@/common/utils/str-util';

export default class CancelByUserError extends Error {
    constructor(message?: string) {
        super(ErrorConstants.CANCEL_MSG + StrUtil.ifBlank(message, ''));
        this.name = 'UserCancelError';
    }
}
