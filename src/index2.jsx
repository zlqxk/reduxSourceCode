import { createStore, combineReducers } from "redux";

// 创建多个reducer

function counter(state = 0, action) {
  switch (action.type) {
    case "INCREMENT":
      return state + 1;
    case "DECREMENT":
      return state - 1;
    default:
      return state;
  }
}

function counter2(state = 0, action) {
  switch (action.type) {
    case "INCREMENT2":
      return state + 1;
    case "DECREMENT2":
      return state - 1;
    default:
      return state;
  }
}

// 这里我们可以看到combineReducers方法接受一个对象为参数，对象的value正是每一个reducer
const rootReducer = combineReducers({
  counter,
  counter2
})

// 传入创建的reducer并创建store
const store = createStore(rootReducer);

// 手动订阅更新 (当dispatch action 将会执行回调函数)
store.subscribe(() =>
  // getState() 用来获取最新的state
  console.log(store.getState())
);

/**
 * 派发action，每次派发action都会在reducer中进行匹配，然后返回对应的state
 * 在上面我们已经手动订阅了更新，所以每次派发action时，都会触发store.subscribe回调函数，然后将最新的state打印出来
 */
store.dispatch({ type: "INCREMENT" });
store.dispatch({ type: "INCREMENT" });
store.dispatch({ type: "INCREMENT" });

store.dispatch({ type: "INCREMENT2" });
store.dispatch({ type: "INCREMENT2" });
store.dispatch({ type: "INCREMENT2" });

