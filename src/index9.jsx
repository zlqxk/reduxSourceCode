import { createStore, applyMiddleware } from "redux";
  import thunk from "redux-thunk";

  const initState = {
    num: 0,
    data: null
  };

  const logger = store => next => action => {
    console.group(action.type)
    console.info('dispatching', action)
    let result = next(action)
    console.log('next state', store.getState())
    console.groupEnd(action.type)
    return result
  }

  function counter(state = initState, action) {
    switch (action.type) {
      case "ADD_NUM1":
        return { ...state, num: state.num + 1 };
      case "FETCH_DATA":
        return {...state, data: action.data }
      default:
        return state;
    }
  }
  // 同时使用了thunk和logger两个中间件
  const store = createStore(counter, applyMiddleware(thunk, logger));

  // 异步请求数据的方法
  const fetchData = () => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve('im asyncdata')
      }, 2000);
    })
  }

  // 这是我们要派发的action，使用了redux-thunk以后，action书写成一个函数，在函数里面dispatch action
  const asyncData = () => {
    return dispatch => {
      fetchData().then(res => {
        dispatch({
          type: 'FETCH_DATA',
          data: res
        })
      }) 
    }
  }

  store.dispatch({ type: "ADD_NUM1" });
  store.dispatch(asyncData());