const fs = require('fs');
const path = require('path');
// 转换语法树
const parser = require('@babel/parser');
// 依赖分析
const traverse = require('@babel/traverse').default;
// 语法转换库
const babel = require('@babel/core');

/**
 * 生成依赖文件
 * @param {*} file 
 */
function getModuleInfo(file) {
    // 读取文件
    const body = fs.readFileSync(file, 'utf-8')

    // 转换抽象语法树
    // var a = 1 => {} 把赋值转换为对象（具体实现比较复杂）
    const ast = parser.parse(body, {
        sourceType: 'module' //声明类型是ES模块
    })
    // console.log('ast', ast);

    // 收集依赖
    const deps = {}
    traverse(ast, {
        ImportDeclaration({ node }) {
            const dirname = path.dirname(file);
            const abspath = './' + path.join(dirname, node.source.value)
            deps[node.source.value] = abspath;
        },
    });
    // console.log('deps',deps);
    // deps { './add.js': './src/add.js' }

    // ES6语法转换为ES5
    const { code } = babel.transformFromAst(ast, null, {
        presets: ['@babel/preset-env'],
    });
    // 输出
    const moduleInfo = { file, deps, code };
    return moduleInfo;
}
// 单个模块
// getModuleInfo('./src/index.js')
// console.log(getModuleInfo('./src/index.js'))

// 多模块递归
function parseModules(file) {
    const entry = getModuleInfo(file);
    const temp = [entry];
    // 最终的依赖关系图
    const depsGraph = {};

    // 递归调用
    getDeps(temp, entry);

    // 组装依赖
    temp.forEach((info) => {
        depsGraph[info.file] = {
            deps: info.deps,
            code: info.code,
        };
    });
    return depsGraph
    
}

// 递归函数
function getDeps(temp, { deps }) {
    Object.keys(deps).forEach(key => {
        const child = getModuleInfo(deps[key]);
        temp.push(child);
        getDeps(temp, child);
    });
}

function bundle(file) {
    const depsGraph = JSON.stringify(parseModules(file));
    console.log(depsGraph)
    return `(function (graph) {
        function require(file) {
        function absRequire(relPath) {
        return require(graph[file].deps[relPath])
        }
        var exports = {};
        (function (require,exports,code) {
        eval(code)
        })(absRequire,exports,graph[file].code)
        return exports
        }
        require('${file}')
        })(${depsGraph})`;
}

const content = bundle('./src/index.js')

// 写入dist
!fs.existsSync('./dist') && fs.mkdirSync('./dist')
fs.writeFileSync('./dist/bundle.js', content);