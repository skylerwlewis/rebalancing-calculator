import './App.css';
import InputProvider from './InputProvider';
import InputView from './InputView';
import UrlParamInputProvider from './UrlParamInputProvider';
import InputUrlParamProvider from './InputUrlParamProvider';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';

function App() {

  return (
    <div className="App">
      <Router>
        <UrlParamInputProvider>
          <InputProvider>
            <InputUrlParamProvider>
            <Routes>
              <Route path='/' element={<InputView/>} />
              </Routes>
            </InputUrlParamProvider>
          </InputProvider>
        </UrlParamInputProvider>
      </Router>
    </div>
  );
}

export default App;
