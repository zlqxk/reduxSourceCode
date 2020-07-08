import { createStore, combineReducers } from "redux";

const count = {
  num:0
}

const count2 = {
  num2:0
}

// 错误用法
// const handleData = (state, type) => {
//   state[type] += 1 
//   return state
// }


const handleData = (state, type) => {
  // state = Object.assign({}, state, {
  //   [type]: state[type] + 1
  // })
  // return state
  // 或者使用展开运算符
  return {...state, [type]:state[type] + 1}
}

function counter(state = count, action) {
  switch (action.type) {
    case "INCREMENT":
      return handleData(state, 'num');
    default:
      return state;
  }
}

function counter2(state = count2, action) {
  switch (action.type) {
    case "INCREMENT2":
      return handleData(state, 'num2');
    default:
      return state;
  }
}

const rootReducer = combineReducers({
  counter,
  counter2
})

const store = createStore(rootReducer);

store.dispatch({ type: "INCREMENT" });
const a = store.getState()
store.dispatch({ type: "INCREMENT" });
const b = store.getState()
store.dispatch({ type: "INCREMENT2" });
const c = store.getState()
store.dispatch({ type: "INCREMENT2" });
const d = store.getState()

console.log(a, 'a');
console.log(b, 'b');
console.log(c, 'b');
console.log(d, 'd');

