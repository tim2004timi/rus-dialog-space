
import { Pool } from 'pg';

// Create a placeholder for your database connection
// You will need to replace these values with your actual database credentials
let pool: Pool | null = null;

export const getDbPool = () => {
  if (!pool) {
    pool = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: Number(process.env.DATABASE_PORT) || 5432,
      database: process.env.DATABASE_NAME || 'messenger',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
    });
  }
  return pool;
};

// For demo purposes, we'll create mock data if we're in development mode
export const setupMockData = async () => {
  if (process.env.NODE_ENV === 'development' || process.env.MOCK_DATA === 'true') {
    console.log('Setting up mock data...');
    const mockChats = [
      { uuid: '1', waiting: false, ai: true },
      { uuid: '2', waiting: true, ai: false },
      { uuid: '3', waiting: false, ai: true },
      { uuid: '4', waiting: false, ai: false },
      { uuid: '5', waiting: true, ai: true },
    ];
    
    const mockMessages = [
      // Chat 1
      { chat_id: 1, message: 'Привет, как дела?', message_type: 'question', ai: false },
      { chat_id: 1, message: 'Все хорошо, спасибо! Чем могу помочь?', message_type: 'answer', ai: true },
      { chat_id: 1, message: 'Мне нужна помощь с проектом', message_type: 'question', ai: false },
      { chat_id: 1, message: 'Конечно, расскажите подробнее о вашем проекте', message_type: 'answer', ai: true },
      
      // Chat 2
      { chat_id: 2, message: 'Вы получили мое последнее сообщение?', message_type: 'question', ai: false },
      
      // Chat 3
      { chat_id: 3, message: 'Можете объяснить, как работает этот алгоритм?', message_type: 'question', ai: false },
      { chat_id: 3, message: 'Да, этот алгоритм работает по принципу...', message_type: 'answer', ai: true },
      
      // Chat 4
      { chat_id: 4, message: 'Когда будет готов отчет?', message_type: 'question', ai: false },
      { chat_id: 4, message: 'Отчет будет готов завтра к обеду', message_type: 'answer', ai: false },
      
      // Chat 5
      { chat_id: 5, message: 'Нужна консультация по новому API', message_type: 'question', ai: false },
    ];
    
    return {
      chats: mockChats,
      messages: mockMessages
    };
  }
  
  return null;
};
