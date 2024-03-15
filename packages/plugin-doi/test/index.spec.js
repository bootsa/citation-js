/* eslint-env mocha */

import assert from "node:assert"
import { plugins } from "../../../test/api.js"(require('@citation-js/core'))
require('../src/index.js')

import data from "./data.js"

describe('input', function () {
  for (const type in data) {
    describe(type, function () {
      it('is registered', function () {
        assert(plugins.input.has(type))
      })

      for (const name of Object.keys(data[type])) {
        const [input, expected, { link, opts } = {}] = data[type][name]
        describe(name, function () {
          it('parses type', function () {
            assert.strictEqual(plugins.input.type(input), type)
          })
          it('parses data', function () {
            const method = link ? plugins.input.chainLink : plugins.input.chain
            const output = method(input, Object.assign({ generateGraph: false }, opts || {}))
            assert.deepStrictEqual(output, expected)
          })
          it('parses data async', async function () {
            const method = link ? plugins.input.chainLinkAsync : plugins.input.chainAsync
            const output = await method(input, Object.assign({ generateGraph: false }, opts || {}))
            assert.deepStrictEqual(output, expected)
          })
        })
      }
    })
  }

  describe('errors', function () {
    it('for non-existent DOI', function () {
      assert.throws(
        () => plugins.input.chain('10.1016/does-not-exist', { generateGraph: false }),
        {
          message: 'Server responded with status code 404'
        }
      )
    })
  })
})
