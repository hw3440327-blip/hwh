import React from 'react';
import { createRoot } from 'react-dom/client';
import ImmersiveApp from './ImmersiveApp.jsx';

const root = import.meta.hot?.data.reactRoot ?? createRoot(document.getElementById('root'));
if (import.meta.hot) import.meta.hot.data.reactRoot = root;
root.render(<ImmersiveApp />);
