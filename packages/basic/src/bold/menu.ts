/**
 * @description bold menu
 * @author wangfupeng
 */

import { Editor } from 'slate'
import { IMenuItem, IDomEditor } from '@wangeditor/core'

class BoldMenu implements IMenuItem {
  title = '加粗'
  iconSvg = `<svg t="1621520771065" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1173" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="200"><defs><style type="text/css"></style></defs><path d="M426.861714 869.156571q42.276571 18.285714 80.018286 18.285714 214.820571 0 214.820571-191.414857 0-65.170286-23.405714-102.838857-15.433143-25.161143-35.108571-42.276571t-38.546286-26.550857-46.006857-14.262857-47.981714-5.997714-53.979429-1.170286q-41.691429 0-57.709714 5.705143 0 30.281143-0.292571 90.843429t-0.292571 90.258286q0 4.534857-0.585143 38.546286t-0.292571 55.149714 2.56 47.689143 6.875429 38.034286zM418.889143 442.88q23.990857 4.022857 62.317714 4.022857 46.884571 0 81.700571-7.460571t62.829714-25.453714 42.569143-51.126857 14.555429-81.115429q0-40.009143-16.603429-69.997714t-45.129143-46.884571-61.732571-24.868571-70.875429-7.972571q-28.598857 0-74.313143 7.460571 0 28.598857 2.267429 86.308571t2.267429 86.820571q0 15.433143-0.292571 45.714286t-0.292571 45.129143q0 26.258286 0.585143 39.424zM109.714286 950.857143l1.170286-53.686857q8.557714-2.267429 48.566857-9.142857t60.562286-15.433143q4.022857-6.875429 7.168-15.433143t4.827429-19.163429 3.145143-18.578286 1.682286-21.430857 0.292571-19.456l0-37.449143q0-561.152-12.580571-585.728-2.267429-4.534857-12.580571-8.265143t-25.453714-6.290286-28.306286-4.022857-27.721143-2.56-17.408-1.682286l-2.267429-47.396571q56.027429-1.170286 194.267429-6.582857t213.138286-5.412571q13.165714 0 39.131429 0.292571t38.546286 0.292571q40.009143 0 77.970286 7.460571t73.435429 23.990857 61.732571 40.594286 42.276571 59.684571 16.018286 78.555429q0 29.696-9.435429 54.564571t-22.308571 41.179429-36.864 32.841143-41.691429 25.746286-47.981714 22.820571q87.990857 19.968 146.578286 76.580571t58.587429 141.677714q0 57.124571-19.968 102.546286t-53.394286 74.605714-78.848 48.859429-93.403429 27.721143-100.571429 7.972571q-25.161143 0-75.410286-1.682286t-75.410286-1.682286q-60.562286 0-175.396571 6.290286t-132.022857 6.875429z" p-id="1174"></path></svg>`
  tag = 'button'

  /**
   * 获取：是否加粗
   * @param editor editor
   */
  getValue(editor: IDomEditor): string | boolean {
    const [match] = Editor.nodes(editor, {
      // @ts-ignore
      match: n => n.bold === true,
      universal: true,
    })

    const isBold = !!match
    return isBold
  }
  isDisabled(editor: IDomEditor): boolean {
    const [match] = Editor.nodes(editor, {
      // @ts-ignore
      match: n => {
        // @ts-ignore
        const { type = '' } = n

        // 代码
        if (type === 'pre') return true

        // header
        if (type.startsWith('header')) return true

        // TODO 检测是否 void

        return false
      },
      universal: true,
    })

    if (match) return true
    return false
  }

  /**
   * 执行 bold 命令
   * @param editor editor
   * @param value 是否加粗
   */
  cmd(editor: IDomEditor, value?: string | boolean) {
    if (value) {
      // 已加粗，则取消
      editor.removeMark('bold')
    } else {
      // 未加粗，则执行
      editor.addMark('bold', true)
    }
  }
}

export default {
  key: 'bold',
  factory() {
    return new BoldMenu()
  },
}
