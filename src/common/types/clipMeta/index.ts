import { ClipMetaInsertV1, ClipMetaV1 } from '@/common/types/clipMeta/ClipMetaDataV1';
import { ClipVersionEnum } from '@/common/types/clipMeta/base';
import { OssObjectType } from '@/common/types/clipMeta/base';

export type ClipMetaInsert = ClipMetaInsertV1;
export type ClipMeta = ClipMetaV1;
export const ClipVersion = ClipVersionEnum.enum['1'];
export type OssObject = OssObjectType;
