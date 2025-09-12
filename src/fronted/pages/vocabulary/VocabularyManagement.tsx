import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import { Search, Download, Upload, BookOpen } from 'lucide-react';
import { cn } from '@/fronted/lib/utils';
import useSetting from '@/fronted/hooks/useSetting';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/fronted/components/ui/table';
import { Badge } from '@/fronted/components/ui/badge';

interface WordItem {
    id: number;
    word: string;
    stem: string;
    translate: string;
    note: string;
    created_at: string;
    updated_at: string;
}

const VocabularyManagement = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [words, setWords] = useState<WordItem[]>([]);
    const [loading, setLoading] = useState(false);
    const theme = useSetting((s) => s.values.get('appearance.theme'));

    const filteredWords = useMemo(() => {
        if (!searchTerm) return words;
        const term = searchTerm.toLowerCase();
        return words.filter(word => 
            word.word.toLowerCase().includes(term) ||
            word.translate?.toLowerCase().includes(term) ||
            word.stem?.toLowerCase().includes(term)
        );
    }, [words, searchTerm]);

    const fetchWords = useCallback(async () => {
        setLoading(true);
        try {
            const result = await window.electron.call('vocabulary/get-all', {});
            if (result.success) {
                setWords(result.data || []);
            }
        } catch (error) {
            console.error('获取单词失败:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const exportTemplate = useCallback(async () => {
        try {
            console.log('开始导出模板...');
            const result = await window.electron.call('vocabulary/export-template', {});
            console.log('导出结果:', result);
            
            if (result.success) {
                console.log('开始处理base64数据，长度:', result.data?.length);
                // 将base64转换为ArrayBuffer
                const binaryString = atob(result.data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                console.log('转换完成，字节数:', bytes.length);
                
                // 创建下载链接
                const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '单词管理模板.xlsx';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                console.log('下载链接已创建');
                
                // 显示成功提示
                setTimeout(() => {
                    alert('模板已成功导出到下载文件夹');
                }, 100);
            } else {
                console.error('导出失败:', result.error);
                alert(`导出失败：${result.error}`);
            }
        } catch (error) {
            console.error('导出模板失败:', error);
            alert('导出失败，请重试');
        }
    }, []);

    const importWords = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const result = await window.electron.call('vocabulary/import', { 
                filePath: file.path 
            });
            
            if (result.success) {
                await fetchWords(); // 重新加载单词列表
            }
        } catch (error) {
            console.error('导入单词失败:', error);
        } finally {
            setLoading(false);
            // 重置文件输入
            event.target.value = '';
        }
    }, [fetchWords]);

    useEffect(() => {
        fetchWords();
    }, [fetchWords]);

    return (
        <div className="container mx-auto p-6 flex flex-col h-full gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BookOpen className="w-6 h-6" />
                        单词管理
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 mb-6">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <Input
                                    placeholder="搜索单词或释义..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={exportTemplate}
                                disabled={loading}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                导出模板
                            </Button>
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={importWords}
                                    disabled={loading}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <Button variant="outline" disabled={loading}>
                                    <Upload className="w-4 h-4 mr-2" />
                                    导入Excel
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="text-sm text-gray-600 mb-4">
                        <p>• 导出模板包含当前所有生词（仅英文和释义），可在Excel中编辑后重新导入覆盖</p>
                        <p>• 导入时将根据英文单词进行匹配，更新释义，词干自动复制英文</p>
                        <p>• 支持xlsx格式文件</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="h-0 flex-1 flex flex-col">
                <CardHeader>
                    <CardTitle>单词列表 ({filteredWords.length})</CardTitle>
                </CardHeader>
                <CardContent className="h-0 flex-1 p-0">
                    <div className="rounded-md border h-full overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>英文</TableHead>
                                    <TableHead>释义</TableHead>
                                    <TableHead>更新时间</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                                加载中...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredWords.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8">
                                            {searchTerm ? '未找到匹配的单词' : '暂无生词记录'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredWords.map((word) => (
                                        <TableRow key={word.id}>
                                            <TableCell className="font-medium">
                                                {word.word}
                                            </TableCell>
                                            <TableCell className="max-w-xs truncate">
                                                {word.translate || '-'}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                                                {new Date(word.updated_at).toLocaleString('zh-CN')}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default VocabularyManagement;