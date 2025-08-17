import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Tag } from '@/backend/db/tables/tag'
import db from '@/backend/db'
import { eq, like } from 'drizzle-orm'
import TagServiceImpl from '../impl/TagServiceImpl'

// Mock inversify
vi.mock('inversify', () => ({
  injectable: () => (target: unknown) => target,
}))

// Mock dependencies
vi.mock('@/backend/db', () => ({
  default: {
    insert: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  }
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: vi.fn(),
    like: vi.fn(),
  }
})

describe('TagServiceImpl', () => {
  let tagService: TagServiceImpl
  let mockDb: typeof db

  beforeEach(() => {
    tagService = new TagServiceImpl()
    mockDb = db
    vi.clearAllMocks()
  })

  describe('addTag', () => {
    it('should add a new tag successfully', async () => {
      const mockTag: Tag = {
        id: 1,
        name: 'test-tag',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      }

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockTag])
      }

      ;(mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(mockInsert)

      const result = await tagService.addTag('test-tag')

      expect(mockDb.insert).toHaveBeenCalled()
      expect(mockInsert.values).toHaveBeenCalledWith({ name: 'test-tag' })
      expect(mockInsert.onConflictDoUpdate).toHaveBeenCalled()
      expect(mockInsert.returning).toHaveBeenCalled()
      expect(result).toEqual(mockTag)
    })

    it('should throw error when name is blank', async () => {
      await expect(tagService.addTag('')).rejects.toThrow('name is blank')
      await expect(tagService.addTag('   ')).rejects.toThrow('name is blank')
      await expect(tagService.addTag(null as unknown as string)).rejects.toThrow('name is blank')
      await expect(tagService.addTag(undefined as unknown as string)).rejects.toThrow('name is blank')
    })

    it('should handle database conflict and update existing tag', async () => {
      const existingTag: Tag = {
        id: 1,
        name: 'existing-tag',
        created_at: '2023-01-01',
        updated_at: '2023-01-02'
      }

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([existingTag])
      }

      ;(mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(mockInsert)

      const result = await tagService.addTag('existing-tag')

      expect(mockInsert.onConflictDoUpdate).toHaveBeenCalledWith({
        target: expect.any(Array),
        set: { name: 'existing-tag' }
      })
      expect(result).toEqual(existingTag)
    })
  })

  describe('deleteTag', () => {
    it('should delete tag by id', async () => {
      const mockDelete = {
        where: vi.fn().mockResolvedValue(undefined)
      }

      ;(mockDb.delete as ReturnType<typeof vi.fn>).mockReturnValue(mockDelete)
      ;(eq as ReturnType<typeof vi.fn>).mockReturnValue('eq-condition')

      await tagService.deleteTag(1)

      expect(mockDb.delete).toHaveBeenCalled()
      expect(eq).toHaveBeenCalledWith(expect.anything(), 1)
      expect(mockDelete.where).toHaveBeenCalledWith('eq-condition')
    })

    it('should handle deletion of non-existent tag gracefully', async () => {
      const mockDelete = {
        where: vi.fn().mockResolvedValue(undefined)
      }

      ;(mockDb.delete as ReturnType<typeof vi.fn>).mockReturnValue(mockDelete)

      await expect(tagService.deleteTag(999)).resolves.toBeUndefined()
    })
  })

  describe('updateTag', () => {
    it('should update tag name', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined)
      }

      ;(mockDb.update as ReturnType<typeof vi.fn>).mockReturnValue(mockUpdate)
      ;(eq as ReturnType<typeof vi.fn>).mockReturnValue('eq-condition')

      await tagService.updateTag(1, 'updated-name')

      expect(mockDb.update).toHaveBeenCalled()
      expect(mockUpdate.set).toHaveBeenCalledWith({ name: 'updated-name' })
      expect(eq).toHaveBeenCalledWith(expect.anything(), 1)
      expect(mockUpdate.where).toHaveBeenCalledWith('eq-condition')
    })
  })

  describe('search', () => {
    it('should search tags by keyword', async () => {
      const mockTags: Tag[] = [
        { id: 1, name: 'javascript', created_at: '2023-01-01', updated_at: '2023-01-01' },
        { id: 2, name: 'java', created_at: '2023-01-01', updated_at: '2023-01-01' }
      ]

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockTags)
      }

      ;(mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(mockSelect)
      ;(like as ReturnType<typeof vi.fn>).mockReturnValue('like-condition')

      const result = await tagService.search('java')

      expect(mockDb.select).toHaveBeenCalled()
      expect(mockSelect.from).toHaveBeenCalled()
      expect(like).toHaveBeenCalledWith(expect.anything(), 'java%')
      expect(mockSelect.where).toHaveBeenCalledWith('like-condition')
      expect(result).toEqual(mockTags)
    })

    it('should return empty array when no tags match', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([])
      }

      ;(mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(mockSelect)

      const result = await tagService.search('nonexistent')

      expect(result).toEqual([])
    })

    it('should handle empty keyword search', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([])
      }

      ;(mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(mockSelect)

      const result = await tagService.search('')

      expect(like).toHaveBeenCalledWith(expect.anything(), '%')
      expect(result).toEqual([])
    })
  })
})