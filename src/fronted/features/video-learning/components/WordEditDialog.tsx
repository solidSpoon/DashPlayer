import React, { useState } from 'react';
import { Sparkles, Loader2, BookMarked } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/fronted/components/ui/dialog';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { Textarea } from '@/fronted/components/ui/textarea';
import { videoLearningApi } from '@/fronted/features/video-learning/videoLearningApi';

/** 编辑弹窗可接收的最小单词信息。 */
export interface EditableWordItem {
  /** 编辑前的单词，作为后端定位记录的业务键。 */
  word: string;
  /** 当前释义。 */
  translate: string;
}

interface WordEditDialogProps {
  open: boolean;
  /** 待编辑的单词；open 为 true 时必须提供。 */
  wordItem: EditableWordItem | null;
  onOpenChange: (open: boolean) => void;
  /**
   * 保存成功后的回调。
   *
   * @param newWord 保存后的单词（已按后端规则小写化）。
   */
  onSaved: (newWord: string) => void;
}

interface WordEditFormProps {
  /** 待编辑的单词。 */
  wordItem: EditableWordItem;
  onOpenChange: (open: boolean) => void;
  onSaved: (newWord: string) => void;
}

/**
 * 单词编辑表单：支持修改单词与释义，并可调用 AI 生成释义。
 *
 * 行为说明：
 * - 单词是业务键，保存时把编辑前的单词一并传给后端用于定位记录；
 * - AI 生成结果写入释义输入框，用户可继续编辑后再保存；
 * - 表单初始值来自 props，切换单词时由外层通过 key 重置。
 */
function WordEditForm({ wordItem, onOpenChange, onSaved }: WordEditFormProps) {
  const { t } = useTranslation('common');
  const [word, setWord] = useState(wordItem.word);
  const [translate, setTranslate] = useState(wordItem.translate || '');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  /** 调用 AI 为当前输入的单词生成释义并填入释义框。 */
  const handleGenerate = async () => {
    const targetWord = word.trim();
    if (!targetWord) {
      toast.error(t('wordCannotBeEmpty'));
      return;
    }

    setGenerating(true);
    try {
      const result = await videoLearningApi.generateDefinition(targetWord);
      if (result.success && result.data) {
        setTranslate(result.data);
      } else {
        toast.error(result.error || t('generateDefinitionFailed'));
      }
    } catch {
      toast.error(t('generateDefinitionFailed'));
    } finally {
      setGenerating(false);
    }
  };

  /** 提交保存；单词变化时后端会同步迁移片段关联。 */
  const handleSave = async () => {
    const nextWord = word.trim();
    if (!nextWord) {
      toast.error(t('wordCannotBeEmpty'));
      return;
    }

    setSaving(true);
    try {
      const result = await videoLearningApi.updateWord(wordItem.word, nextWord, translate.trim());
      if (result.success) {
        toast.success(t('wordSaved'));
        onOpenChange(false);
        onSaved(nextWord.toLowerCase());
      } else {
        toast.error(result.error || t('wordSaveFailed'));
      }
    } catch {
      toast.error(t('wordSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-[440px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <BookMarked className="w-4 h-4 text-primary" />
          {t('editWord')}
        </DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4 py-2 text-xs">
        <div className="flex flex-col gap-2">
          <Label htmlFor="word-edit-input" className="text-xs font-medium">{t('wordField')}</Label>
          <Input
            id="word-edit-input"
            className="text-sm"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder={t('wordField')}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="word-edit-translate" className="text-xs font-medium">{t('definitionField')}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
              onClick={handleGenerate}
              disabled={generating || saving}
            >
              {generating
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Sparkles className="w-3.5 h-3.5" />}
              {generating ? t('generating') : t('aiGenerateDefinition')}
            </Button>
          </div>
          <Textarea
            id="word-edit-translate"
            className="text-sm min-h-[88px] resize-none"
            value={translate}
            onChange={(e) => setTranslate(e.target.value)}
            placeholder={t('noDefinition')}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
          {t('cancel')}
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={saving || generating}>
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
          {t('save')}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/**
 * 单词编辑弹窗；按单词名重置内部表单状态。
 */
export default function WordEditDialog({ open, wordItem, onOpenChange, onSaved }: WordEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {wordItem && (
        <WordEditForm
          key={wordItem.word}
          wordItem={wordItem}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}
