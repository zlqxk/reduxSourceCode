import { createStore, bindActionCreators } from "redux";

const initState = {
  num1: 0,
  num2: 0,
  num3: 0,
  num4: 0
};

function counter(state = initState, action) {
  switch (action.type) {
    case "ADD_NUM1":
      return { ...state, num1: state.num1 + 1 };
    case "ADD_NUM2":
      return { ...state, num2: state.num2 + 1 };
    case "ADD_NUM3":
      return { ...state, num3: state.num3 + 1 };
    case "ADD_NUM4":
      return { ...state, num4: state.num4 + 1 };
    default:
      return state;
  }
}

const store = createStore(counter);

// 声明了四个的action creator，返回值就是要派发的action
const ADD_NUM1 = () => {
  return {
    type: "ADD_NUM1"
  };
};
const ADD_NUM2 = () => {
  return {
    type: "ADD_NUM2"
  };
};
const ADD_NUM3 = () => {
  return {
    type: "ADD_NUM3"
  };
};
const ADD_NUM4 = () => {
  return {
    type: "ADD_NUM4"
  };
};

/**
 * bindActionCreators(actionCreators, dispatch)
 * 这个方法接受两个参数
 * actionCreators： 一个 action creator，或者一个 value 是 action creator 的对象。
 * dispatch： 一个由 Store 实例提供的 dispatch 函数。
 */
const boundActionCreators = bindActionCreators(
  {
    ADD_NUM1,
    ADD_NUM2,
    ADD_NUM3,
    ADD_NUM4
  },
  store.dispatch
);

console.log(boundActionCreators);

// 这样就可以通过下面的方式调用了
boundActionCreators.ADD_NUM1();
boundActionCreators.ADD_NUM2();
boundActionCreators.ADD_NUM3();
boundActionCreators.ADD_NUM4();

console.log(store.getState());