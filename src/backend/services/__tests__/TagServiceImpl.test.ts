import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Tag } from '@/backend/infrastructure/db/tables/tag';
import TagServiceImpl from '../impl/TagServiceImpl';

// Mock inversify
vi.mock('inversify', () => ({
    injectable: () => (target: unknown) => target,
    inject: () => (target: unknown, _propertyKey: string) => target,
}));

describe('TagServiceImpl', () => {
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
    (tagService as any).favouriteClipsRepository = mockRepo;
    vi.clearAllMocks();
  });

  describe('addTag', () => {
    it('should add a new tag successfully', async () => {
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

    it('should throw error when name is blank', async () => {
      await expect(tagService.addTag('')).rejects.toThrow('name is blank');
      await expect(tagService.addTag('   ')).rejects.toThrow('name is blank');
      await expect(tagService.addTag(null as unknown as string)).rejects.toThrow('name is blank');
      await expect(tagService.addTag(undefined as unknown as string)).rejects.toThrow('name is blank');
    });

    it('should handle existing tag', async () => {
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

  describe('deleteTag', () => {
    it('should delete tag by id', async () => {
      mockRepo.deleteTagById.mockResolvedValue(undefined);

      await tagService.deleteTag(1);

      expect(mockRepo.deleteTagById).toHaveBeenCalledWith(1);
    });

    it('should handle deletion of non-existent tag gracefully', async () => {
      mockRepo.deleteTagById.mockResolvedValue(undefined);

      await expect(tagService.deleteTag(999)).resolves.toBeUndefined();
    });
  });

  describe('updateTag', () => {
    it('should update tag name', async () => {
      mockRepo.updateTagName.mockResolvedValue(undefined);

      await tagService.updateTag(1, 'updated-name');

      expect(mockRepo.updateTagName).toHaveBeenCalledWith(1, 'updated-name');
    });
  });

  describe('search', () => {
    it('should search tags by keyword', async () => {
      const mockTags: Tag[] = [
        { id: 1, name: 'javascript', created_at: '2023-01-01', updated_at: '2023-01-01' },
        { id: 2, name: 'java', created_at: '2023-01-01', updated_at: '2023-01-01' }
      ];
      mockRepo.searchTagsByPrefix.mockResolvedValue(mockTags);

      const result = await tagService.search('java');

      expect(mockRepo.searchTagsByPrefix).toHaveBeenCalledWith('java');
      expect(result).toEqual(mockTags);
    });

    it('should return empty array when no tags match', async () => {
      mockRepo.searchTagsByPrefix.mockResolvedValue([]);

      const result = await tagService.search('nonexistent');

      expect(result).toEqual([]);
    });

    it('should handle empty keyword search', async () => {
      mockRepo.searchTagsByPrefix.mockResolvedValue([]);

      const result = await tagService.search('');

      expect(mockRepo.searchTagsByPrefix).toHaveBeenCalledWith('');
      expect(result).toEqual([]);
    });
  });
});
