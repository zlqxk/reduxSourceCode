import { createStore, combineReducers } from "redux";
import { fromJS } from 'immutable';

const initState = {
  num: 0,
}


// 使用formJS来将js对象转换为immutable对象
function counter(state = fromJS(initState), action) {
  switch (action.type) {
    case "INCREMENT":
      return state.set('num', state.get('num') + 1)
    default:
      return state;
  }
}

const store = createStore(counter);

store.dispatch({ type: "INCREMENT" });
const a = store.getState().get('num')
store.dispatch({ type: "INCREMENT" });
const b = store.getState().get('num')

console.log(a, 'a');
console.log(b, 'b');


