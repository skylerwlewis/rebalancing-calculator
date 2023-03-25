import './App.css';
import InputProvider from './input/InputProvider';
import InputView from './input/InputView';
import UrlParamInputProvider from './share/UrlParamInputProvider';
import InputUrlParamProvider from './share/InputUrlParamProvider';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { blue } from '@mui/material/colors';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: blue[400]
    },
    secondary: {
      main: blue[100]
    }
  }
});

const App = () => {

  return (
    <div className="App">
      <ThemeProvider theme={theme}>
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
      </ThemeProvider>
    </div>
  );
}

export default App;
