// src/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './CombinedInternalTool'; // 파일명 그대로 쓰면 default export가 App입니다.
import './index.css';

const root = createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><App /></React.StrictMode>);
