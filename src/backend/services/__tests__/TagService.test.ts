import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Tag } from '@/backend/infrastructure/db/tables/tag';
import { TagServiceImpl } from '../TagService';

// Mock inversify
vi.mock('inversify', () => ({
    injectable: () => (target: unknown) => target,
    inject: () => (target: unknown, _propertyKey: string) => target,
}));

describe('标签服务', () => {
  let tagService: TagServiceImpl;
  let mockRepo: {
    ensureTag: ReturnType<typeof vi.fn>;
    deleteTagById: ReturnType<typeof vi.fn>;
    updateTagName: ReturnType<typeof vi.fn>;
    searchTagsByPrefix: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    tagService = new TagServiceImpl();
    mockRepo = {
      ensureTag: vi.fn(),
      deleteTagById: vi.fn(),
      updateTagName: vi.fn(),
      searchTagsByPrefix: vi.fn(),
    };
    (tagService as unknown as { favouriteClipsRepository: typeof mockRepo }).favouriteClipsRepository = mockRepo;
    vi.clearAllMocks();
  });

  describe('添加标签', () => {
    it('可以成功添加新标签', async () => {
      const mockTag: Tag = {
        id: 1,
        name: 'test-tag',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };
      mockRepo.ensureTag.mockResolvedValue(mockTag);

      const result = await tagService.addTag('test-tag');

      expect(mockRepo.ensureTag).toHaveBeenCalledWith('test-tag');
      expect(result).toEqual(mockTag);
    });

    it('标签名称为空时会抛出错误', async () => {
      await expect(tagService.addTag('')).rejects.toThrow('name is blank');
      await expect(tagService.addTag('   ')).rejects.toThrow('name is blank');
      await expect(tagService.addTag(null as unknown as string)).rejects.toThrow('name is blank');
      await expect(tagService.addTag(undefined as unknown as string)).rejects.toThrow('name is blank');
    });

    it('标签已存在时返回原标签', async () => {
      const existingTag: Tag = {
        id: 1,
        name: 'existing-tag',
        created_at: '2023-01-01',
        updated_at: '2023-01-02'
      };
      mockRepo.ensureTag.mockResolvedValue(existingTag);

      const result = await tagService.addTag('existing-tag');

      expect(mockRepo.ensureTag).toHaveBeenCalledWith('existing-tag');
      expect(result).toEqual(existingTag);
    });
  });

  describe('删除标签', () => {
    it('可以按编号删除标签', async () => {
      mockRepo.deleteTagById.mockResolvedValue(undefined);

      await tagService.deleteTag(1);

      expect(mockRepo.deleteTagById).toHaveBeenCalledWith(1);
    });

    it('删除不存在的标签时正常结束', async () => {
      mockRepo.deleteTagById.mockResolvedValue(undefined);

      await expect(tagService.deleteTag(999)).resolves.toBeUndefined();
    });
  });

  describe('修改标签', () => {
    it('可以修改标签名称', async () => {
      mockRepo.updateTagName.mockResolvedValue(undefined);

      await tagService.updateTag(1, 'updated-name');

      expect(mockRepo.updateTagName).toHaveBeenCalledWith(1, 'updated-name');
    });
  });

  describe('搜索标签', () => {
    it('可以按关键字搜索标签', async () => {
      const mockTags: Tag[] = [
        { id: 1, name: 'javascript', created_at: '2023-01-01', updated_at: '2023-01-01' },
        { id: 2, name: 'java', created_at: '2023-01-01', updated_at: '2023-01-01' }
      ];
      mockRepo.searchTagsByPrefix.mockResolvedValue(mockTags);

      const result = await tagService.search('java');

      expect(mockRepo.searchTagsByPrefix).toHaveBeenCalledWith('java');
      expect(result).toEqual(mockTags);
    });

    it('没有匹配标签时返回空数组', async () => {
      mockRepo.searchTagsByPrefix.mockResolvedValue([]);

      const result = await tagService.search('nonexistent');

      expect(result).toEqual([]);
    });

    it('允许使用空关键字搜索', async () => {
      mockRepo.searchTagsByPrefix.mockResolvedValue([]);

      const result = await tagService.search('');

      expect(mockRepo.searchTagsByPrefix).toHaveBeenCalledWith('');
      expect(result).toEqual([]);
    });
  });
});
