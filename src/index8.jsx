import { createStore, applyMiddleware } from "redux";

  /**
   * 记录所有被发起的 action 以及产生的新的 state。的中间件
   * 相信大家在读完redux官网的文章以后肯定可以理解下面这个中间件函数
   */
  const logger = store => next => action => {
    console.group(action.type)
    console.info('dispatching', action)
    let result = next(action)
    console.log('next state', store.getState())
    console.groupEnd(action.type)
    return result
  }


  const initState = {
    num: 0,
  };

  function counter(state = initState, action) {
    switch (action.type) {
      case "ADD_NUM1":
        return { ...state, num: state.num + 1 };
      default:
        return state;
    }
  }

  const store = createStore(counter, applyMiddleware(logger));

  store.dispatch({type: 'ADD_NUM1'})
  store.dispatch({type: 'ADD_NUM1'})