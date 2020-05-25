import React, { useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import {connect} from 'react-redux'
import {
    updateObject,
    getSelections,
    getSceneObjects
  } from '../../../../shared/reducers/shot-generator'
  import fs from 'fs-extra'
  import path from 'path'
import { useCallback } from 'react'
import FileInput from '../../FileInput'
import deepEqualSelector from '../../../../utils/deepEqualSelector'
import { truncateMiddle } from '../../../../utils'
import emotions from '../../../../shared/reducers/shot-generator-presets/emotions.json'
import { NUM_COLS, ITEM_HEIGHT, CHARACTER_MODEL } from '../../../utils/InspectorElementsSettings'
import EmotionInspectorItem from './EmotionInspectorItem'
import Grid from '../../Grid'
import Scrollable from '../../Scrollable';
import FaceMesh  from '../../Three/Helpers/FaceMesh'
import { filepathFor } from '../../../utils/filepathFor'
import { useAsset } from '../../../hooks/use-assets-manager'
import { comparePresetNames, comparePresetPriority } from '../../../utils/searchPresetsForTerms'
import SearchList from '../../SearchList/index.js'

const loadImages = (files, baseDir) => {
    return new Promise((resolve, reject) => {
      let projectDir = path.dirname(baseDir)
      let assetsDir = path.join(projectDir, 'models', 'images')
      fs.ensureDirSync(assetsDir)
  
      let dsts = []
      for (let src of files) {
        let dst = path.join(assetsDir, path.basename(src))
        try {
          fs.copySync(src, dst)
          dsts.push(dst)
        } catch (err) {
          reject(src)
        }
      }
  
      let ids = dsts.map(filepath => path.relative(projectDir, filepath))
      
      resolve(ids)
    })
  }
const getModelData = deepEqualSelector([(state) => {
    const selectedId = getSelections(state)[0]
    const object = getSceneObjects(state)[selectedId]
  
    return {
      sceneObject: object,
      characterPath: filepathFor(CHARACTER_MODEL)
    }
  }], data => data)
const EmotionsInspector = connect(
    getModelData,
    {
        updateObject,
        withState: (fn) => (dispatch, getState) => fn(dispatch, getState()),
    }
  )( React.memo(({
    sceneObject,
    updateObject,
    characterPath,
    withState
  }) => {
    const thumbnailRenderer = useRef()
    const textureLoader = useRef(new THREE.TextureLoader())
    const faceMesh = useRef(new FaceMesh())
    const [results, setResult] = useState( Object.values(emotions)) 
    const {asset: attachment} = useAsset(characterPath)
    const onSelectFile = filepath => {

        if (filepath.file) {
          let storyboarderFilePath
          withState((dispatch, state) => {
            storyboarderFilePath = state.meta.storyboarderFilePath
          })
          loadImages(filepath.files, storyboarderFilePath)
          .then((ids) => {
            updateObject(sceneObject.id, { emotion: ids[0] }) 
          })
        }
    }

    const presets = useMemo(() => {
      let sortedPoses = Object.values(emotions).sort(comparePresetNames).sort(comparePresetPriority).map((preset, index) => {
        return {
          ...preset,
          value: preset.name + "|" + preset.keywords,
          index: index
        }
      })
      setResult(sortedPoses)
      return sortedPoses
    }, [])

    const saveFilteredPresets = useCallback(filteredPreset => {
      let objects = []
      for(let i = 0; i < filteredPreset.length; i++) {
        objects.push(presets[filteredPreset[i].index])
      }
      setResult(objects)
    }, [presets])

    const selectValue = useCallback(() => {
        const ext = path.extname(sceneObject.emotion)
        const basenameWithoutExt = path.basename(sceneObject.emotion, ext)
        const displayName = truncateMiddle(basenameWithoutExt, 13)
        return displayName
    }, [sceneObject.emotion])

    const onSelectItem = (filepath) => {
      updateObject(sceneObject.id, { emotion: filepath }) 
    } 

    const refClassName = classNames( "button__file", "button__file--selected")
    // allow a little text overlap
    const wrapperClassName = "button__file__wrapper"

    return <div className="thumbnail-search column">
        <div className="row" style={{ padding: "6px 0" }}>
          <SearchList label="Search models …" list={ presets } onSearch={ saveFilteredPresets }/>
          <div className="column" style={{ alignSelf: "center", padding: 6, lineHeight: 1 } }>or</div>
          <FileInput value={ sceneObject.emotion ? selectValue() : "Select File …" }
                     title={ sceneObject.emotion ? path.basename(sceneObject.emotion) : undefined }
                     onChange={ onSelectFile }
                     refClassName={ refClassName }
                     wrapperClassName={ wrapperClassName }/>
        </div>
        <Scrollable>
              <Grid
                itemData={{
                  id: sceneObject.id,
                  onSelectItem,
                  thumbnailRenderer,
                  textureLoader,
                  faceMesh,
                  attachment,
                  selectedSrc: sceneObject.emotion
                }}
                Component={EmotionInspectorItem}
                elements={results}
                numCols={NUM_COLS}
                itemHeight={ITEM_HEIGHT}
              />
            </Scrollable>
      </div>
}))
export default EmotionsInspector