
class KVue {
  constructor(options) {
    this.$el = options.el;
    const elem = document.querySelector(options.el);
    this._template = elem;
    this._parentNode = elem.parentNode;
    this.$data = options.data;
    this.$options = options;

    initRender(this);

    // 1. 对数据做响应式
    observer(options.data);

    // 2. 为$data做代理
    const keys = Object.keys(options.data);
    let i = keys.length;
    while (i--) {
      const key = keys[i];
      proxy(this, "$data", key);
    }

    // 执行挂载
    // 如果用户设置了el选项的组件，会自动挂载
    if(options.el){
        this.$mount(options.el);
    }
  }
}

function initRender(vm){
    vm.$createElement = (a, b, c, d) => createElement(a, b, c, d); 
}

function createElement(context, tag, data, children){
    return _createElement(context, tag, data, children);
}

// 创建节点虚拟dom
// 1. 原生标签 div
// 2. 自定义组件 comp
function _createElement(context, tag, data, children){
    let vnode;
    if(typeof tag === 'string'){
        // 直接创建vnode
        vnode = new VNode(tag, data, children);
    }
    return vnode;
}

KVue.prototype.$mount = function(el){
    this.$el = document.querySelector(el);
    this._render = this.createRenderFn();
    return mountComponent(this, el);
}

KVue.prototype.createRenderFn = function(){
    // 生成带坑的vnode
    let ast = getVNode(this._template);

    // 将带坑的vnode + data => 带数据的vnode
    return function render(){
        return combine(ast, this.$data);
    }
}

KVue.prototype._update = function(vnode){
    let prevVnode = this._vnode;
    if(!prevVnode){
        // 初始化
        this.__patch__(this.$el, vnode);

    }else{
        // 更新流程
        this.__patch__(prevVnode, vnode);
    }

    this._vnode = vnode;
}

KVue.prototype.__patch__ = function(oldVnode, vnode){
    // 判断oldVnode是否是真实dom
    if(oldVnode.nodeType){
        const parent = oldVnode.parentNode;
        const refElm = oldVnode.nextSibling;
        const el = this.createElm(vnode);
        parent.insertBefore(el, refElm);
        parent.removeChild(oldVnode);

        this._vnode = vnode;
    }else{
        // 获取要更新的元素
        const el = vnode.el = oldVnode.el;

        // 同层比较相同的节点
        if(oldVnode.tag === vnode.tag){
            // 获取双方的孩子节点
            const newCh = vnode.children.length > 0 ? vnode.children : vnode.value;
            const oldCh = oldVnode.children.length > 0 ? oldVnode.children : oldVnode.value;
            if(typeof newCh === 'string'){
                if(typeof oldCh === 'string'){
                    // 文本更新
                    if(newCh !== oldCh){
                        el.textContent = newCh;
                    }
                }else{
                    el.textContent = newCh;
                }
            }else{
                if(typeof oldCh === 'string'){
                    el.textContent = '';
                    // 循环创建并追加

                }else{
                    this.updateChildren(el, oldCh, newCh);
                }
            }
        }

    }
}

KVue.prototype.updateChildren = function(parentElm, oldCh, newCh){
    const len = Math.min(oldCh.length, newCh.length);
    for(let i = 0; i < len; i++){
        this.__patch__(oldCh[i], newCh[i]);
    }

    if(newCh.length > oldCh.length){
        newCh.slice(len).forEach((child) => {
            const _el = this.createElm(child);
            parentElm.appendChild(_el);
        })
    }else if(oldCh.length > newCh.length){
        oldCh.slice(len).forEach((child) => {
            parentElm.removeChild(child.el);
        })
    }
}

// 创建真实节点 vnode => dom
KVue.prototype.createElm = function(vnode){
    return parseVNode(vnode);
}

function parseVNode(vnode){
    const type = vnode.type;
    let _node;
    if(type === 3){
        _node = document.createTextNode(vnode.value);
    }else if(type === 1){
        _node = document.createElement(vnode.tag);

        const data = vnode.data;
        Object.keys(data).forEach((key) => {
            const attrName = key;
            const attrValue = data[key];
            _node.setAttribute(attrName, attrValue);
        })

        vnode.children.forEach((child) => {
            _node.appendChild(parseVNode(child));
        })
    }
    vnode.el = _node;
    return _node;
}

function mountComponent(vm, el){
    const updateComponent = () => {
        vm._update(vm._render());
    }

    new Watcher(vm, updateComponent);
}

function observer(value) {
  if (!isObject(value)) {
    return;
  }

  // 初始化传入需要响应式的对象
  new Observer(value);
}

function proxy(target, sourceKey, key) {
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get() {
      return target[sourceKey][key];
    },
    set(val) {
      target[sourceKey][key] = val;
    },
  });
}

class Observer {
  constructor(value) {
    this.value = value;

    if (!Array.isArray(value)) {
      this.walk(value);
    }
  }

  walk(obj) {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i], obj[keys[i]]);
    }
  }
}

function defineReactive(obj, key, val) {
  observer(val);

  let dep = new Dep();

  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get() {
      console.log("get:", val);
      Dep.target && dep.addDep(Dep.target);
      return val;
    },
    set(newVal) {
      if (newVal !== val) {
        console.log("set:", newVal);
        val = newVal;
        dep.notify();
      }
    },
  });
}

function getVNode(node){
    const nodeType = node.nodeType;
    let _vnode = null;
    if(nodeType === 1){  //元素节点
        let nodeName = node.nodeName;
        let attrs = node.attributes;
        let _attrsObj = {};
        for(let i = 0; i < attrs.length; i++){
            _attrsObj[attrs[i].nodeName] = attrs[i].nodeValue;
        }
        _vnode = new VNode(nodeName, _attrsObj, undefined, nodeType);

        // 子元素
        const childNodes = node.childNodes;
        for(let i = 0; i < childNodes.length; i++){
            _vnode.appendChild(getVNode(childNodes[i]));
        }
    }else if(nodeType === 3){  // 文本节点
        _vnode = new VNode(undefined, undefined, node.nodeValue, nodeType);
    }
    return _vnode;
}

class VNode{
    constructor(tag, data, value, type){
        this.tag = tag;
        this.data = data;
        this.value = value;
        this.type = type;
        this.children = [];
    }

    appendChild(child){
        this.children.push(child);
    }
}

const rkuohao = /\{\{(.+?)\}\}/g;

//根据路径访问对象成员
function getValueByPath(data, path){
    const paths = path.split('.');
    let res = data;
    let prop;
    while(prop = paths.shift()){
        res = res[prop];
    }
    return res;
}

/** 将 带有坑的 VNode 与数据 data 相结合，得到 填充数据的 VNode: 模拟 AST -> VNode */
function combine(vnode, data){
    const _tag = vnode.tag;
    const _type = vnode.type;
    const _data = vnode.data;
    let _value = vnode.value;
    const _children = vnode.children;

    let _vnode = null;
    if(vnode.type === 1){   //元素节点
        _vnode = new VNode(_tag, _data, _value, _type);
        _children.forEach((child) => _vnode.appendChild(combine(child, data)));

    }else if(vnode.type === 3){   //文本节点
        _value = _value.replace(rkuohao, (_, g) => {
            return getValueByPath(data, g.trim());
        })
        _vnode = new VNode(_tag, _data, _value, _type);
    }
    return _vnode;
}

class Watcher{
    constructor(vm, fn){
        this.vm = vm;
        this.getter = fn;
        this.get();
    }

    get(){
        // 依赖收集的触发
        // 调用getter方法其实就是在做依赖收集(组件更新函数的核心观点就是要执行render函数)
        // render函数一触发，依赖收集也就触发了
        Dep.target = this;
        this.getter.call(this.vm);
        Dep.target = null;
    }

    update(){
        this.get();
    }
}

class Dep{
    constructor(){
        // 使用Set防止watcher重复
        this.deps = new Set();
    }

    addDep(watcher){
        this.deps.add(watcher);
    }

    notify(){
        this.deps.forEach((watcher) => {
            watcher.update();
        })
    }
}

Dep.target = null;

function isObject(obj){
    return obj !== null && typeof obj === 'object';
}