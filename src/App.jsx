import { useEffect, useState } from 'react';
import EventList from './pages/EventList.jsx';
import EventEditor from './pages/EventEditor.jsx';
import Caller from './pages/Caller.jsx';
import Display from './pages/Display.jsx';

// Hash routes keep hosting simple: any static host works with no rewrites.
//   #/              events
//   #/event/:id     set up an event
//   #/run/:id       caller
//   #/display       TV board

const currentPath = () => location.hash.replace(/^#/, '') || '/';
export const navigate = (path) => {
  location.hash = path;
};

export default function App() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const on = () => {
      setPath(currentPath());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const [, section, id] = path.split('/');
  if (section === 'display') return <Display />;
  if (section === 'event' && id) return <EventEditor id={id} />;
  if (section === 'run' && id) return <Caller id={id} />;
  return <EventList />;
}
