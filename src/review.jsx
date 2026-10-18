// Standalone, unpublished review entry. Production uses main.jsx instead.
import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import './style.css';
function Review(){const [path,setPath]=useState('/');useEffect(()=>{function navigate(e){const a=e.target.closest('a');if(!a||a.hasAttribute('download'))return;const href=a.getAttribute('href');if(!href||href.startsWith('mailto:')||href.startsWith('data:'))return;if(href.startsWith('/')||href.startsWith('#')){e.preventDefault();const [route,hash]=href.split('#');setPath(route||'/');setTimeout(()=>{if(hash)document.getElementById(hash)?.scrollIntoView();else window.scrollTo(0,0);},0);}}document.addEventListener('click',navigate);return()=>document.removeEventListener('click',navigate);},[]);return <App path={path}/>;}
createRoot(document.getElementById('root')).render(<Review/>);
