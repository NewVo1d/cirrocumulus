import {createMuiTheme} from '@material-ui/core/styles';
import {ThemeProvider} from '@material-ui/styles';
import React from 'react';
import {render} from 'react-dom';
import {Provider} from 'react-redux';
import {applyMiddleware, createStore} from 'redux';
import thunkMiddleware from 'redux-thunk';
import {initGapi} from './actions';
import App from './App';
import rootReducer from './reducers';
// import * as serviceWorker from './serviceWorker';

const theme = createMuiTheme(
    {
        "palette": {
            "type": "light"
        }
    }
);
// const logger = store => next => action => {
//     console.log('dispatching', action);
//     let result = next(action);
//     return result;
// };
const store = createStore(
    rootReducer,
    applyMiddleware(
        thunkMiddleware
    ),
);

function main() {
    render(
        <Provider store={store}>
            <ThemeProvider theme={theme}>
                <App/>
            </ThemeProvider>
        </Provider>,
        document.getElementById('root'),
    );
}

// if (module.hot) {
//   if (process.env.NODE_ENV !== 'production' && module.hot) {
//     module.hot.accept('./reducers', () => store.replaceReducer(rootReducer));
//   }
//   if (process.env.NODE_ENV !== 'production' && module.hot) {
//     module.hot.accept('./App', main);
//   }
// }
store.dispatch(initGapi());
main();

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
// serviceWorker.unregister();
