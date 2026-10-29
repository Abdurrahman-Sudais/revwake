import React from 'react';
import {hydrateRoot} from 'react-dom/client';
import App from './App.jsx';
import './style.css';
import './app/app.css';
const path=window.location.pathname.replace(/\/$/,'')||'/';
hydrateRoot(document.getElementById('root'),<App path={path}/>);
