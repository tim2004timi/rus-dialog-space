
// We need to make this file work in the browser environment
// PostgreSQL client can't run in the browser, so we'll use mock data

// Types to match PostgreSQL client
type Pool = {
  query: (text: string, params?: any[]) => Promise<any>;
  end: () => Promise<void>;
};

let pool: Pool | null = null;

export const getDbPool = () => {
  if (!pool) {
    // Create a mock pool for client-side
    pool = {
      query: async (text: string, params?: any[]) => {
        console.log('Mock DB query:', text, params);
        return { rows: [] };
      },
      end: async () => {
        console.log('Mock pool connection ended');
      }
    };
  }
  return pool;
};

// For demo purposes, we'll create mock data
export const setupMockData = async () => {
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
};
