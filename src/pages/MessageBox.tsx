import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { getAiContext, putAiContext } from '@/lib/api';
import { toast } from '@/components/ui/sonner';

const MessageBox = () => {
  const navigate = useNavigate();
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const fetchedContext = await getAiContext();
        setContext(fetchedContext);
      } catch (error) {
        console.error('Failed to fetch AI context:', error);
        toast.error('Не удалось загрузить контекст ИИ.');
      } finally {
        setLoading(false);
      }
    };
    fetchContext();
  }, []);

  const handleSubmit = async () => {
    try {
      await putAiContext(context);
      toast.success('Контекст ИИ успешно отправлен!');
    } catch (error) {
      console.error('Failed to send AI context:', error);
      toast.error('Не удалось отправить контекст ИИ.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Добавить контекст для ИИ</h1>
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="hover:bg-gray-100"
          >
            Назад
          </Button>
        </div>
        
        <div className="space-y-4">
          {loading ? (
            <div className="text-center text-gray-500">Загрузка контекста...</div>
          ) : (
            <Textarea
              placeholder="Введите ваш контекст или сообщение здесь..."
              className="min-h-[300px] p-4 text-base border-gray-200 focus:border-gray-400 focus:ring-gray-400"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          )}
          
          <div className="flex justify-end">
            <Button
              className="bg-black text-white hover:bg-gray-800"
              onClick={handleSubmit}
              disabled={loading}
            >
              Отправить ИИ
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBox; 