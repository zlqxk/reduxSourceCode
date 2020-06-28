import { createStore } from "redux";

// 创建reducer

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

// 传入创建的reducer并创建store

const store = createStore(counter);

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
