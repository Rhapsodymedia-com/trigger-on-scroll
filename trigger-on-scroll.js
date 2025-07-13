(function(){
    'use strict';
    require.config({
        paths: {
            CerosSDK: '//sdk.ceros.com/standalone-player-sdk-v5.min'
        }
    });
    require(['CerosSDK'], function (CerosSDK) {
        CerosSDK.findExperience()
            .fail(function (error) {
                console.error(error)
            })
            .done(function (experience) {
                let pageTop = document.querySelector("div.page-viewport.top")
                let pinnedContainer = pageTop.querySelector('div.pinned-container')
                let pageContainer = pageTop.querySelector('div.page-container')
                let pageScroll = pageContainer.querySelector('div.page-scroll')

                // CHECKING IF THERE IS PINNED CONTAINER
                let isContainer = pinnedContainer!=undefined
                let appendingContainer = isContainer===true ? pinnedContainer : pageContainer 

                // BASIC VARIABLES
                let allOnScrolls = experience.findLayersByTag("on-scroll").layers
                let pageNum =  experience.getCurrentPage().getPageNumber()
                let pageHeight = experience.getCurrentPage().getHeight()
                let pageScale = 1

                // SCROLL ELEMENTS VARIABLES
                let strings = ['scroll-effect:', 'scroll-range:']
                let allTags = []

                // CREATING THE BLUEPRINT OF SCROLLING OBJECTS
                let scrollObjects = []
                class ScrollObject {
                    constructor(object, node, parentElem, position, effects, margin, start, end, localValues, isPinned=false, isClicked=false){
                        this.object = object;
                        this.node = node;
                        this.parentElem = parentElem;
                        this.position = position;
                        this.effects = effects;
                        this.margin = margin;
                        this.start = start;
                        this.end = end;
                        this.localValues = localValues;
                        this.isPinned = isPinned;
                        this.isClicked = isClicked;
                    }
                }

                // UPDATING PAGE SCALE VALUE
                const updatePageScale = () => {
                    let isZoom = pageTop.style.zoom!=undefined && pageTop.style.zoom!=''
                    let zoomValue = isZoom===true ? pageTop.style.zoom : pageTop.style.transform.split('(')[1].split(')')[0].split(',')[0]
                    pageScale = parseFloat(zoomValue) || 1
                }
                window.addEventListener('resize', updatePageScale)
                updatePageScale()

                // FIXING THE ISSUE WITH PINNED ELEMENTS
                const removePinnedContainerListeners = () => {
                    let pinContainer = $(document.querySelector('.pinned-container'))[0]
                    for(const prop in pinContainer){
                        if(prop.includes('jQuery')===true){
                            const listener = pinContainer[prop].handle
                            const allEvents = pinContainer[prop].events
                            for(const eventType in allEvents){
                                let eventTypes = allEvents[eventType]
                                for(let q=0; q<eventTypes.length; q++)
                                    pinnedContainer.removeEventListener(eventTypes[q].type, listener)
                            }
                            break
                        }
                    }
                }

                // ALTERNATIVE BEHAVIOUR WHEN THE EXPERIENCE IS EMBEDDED
                const parentPageFunction = event => {
                    if(event.data==undefined || event.data==='Ceros experience has been loaded' || typeof event.data!='string')
                        return

                    const datas = JSON.parse(event.data) || {isScrollTrigger: false}
                    if(datas.isScrollTrigger===true)
                        pageContainer.scrollTop = Math.max(-(datas.scrollValue/pageScale), 0)
                }
                if(window.cerosContext.isEmbedded===true){
                    removePinnedContainerListeners()
                    window.top.postMessage('Ceros experience has been loaded', '*')
                    window.addEventListener('message', parentPageFunction)
                }

                // MISCELLANEOUS FUNCTIONS
                const compareTopValues = (one, two) => parseFloat(one.style.getPropertyValue('top')) - parseFloat(two.style.getPropertyValue('top'))
                const getDistance = elem => {
                    let firstParent = elem.parentElement
                    let parentsTopPositions = 0
                    let tries = 0
                    while(firstParent!=pageScroll || tries>=50){
                        let secondParent = firstParent.parentElement
                        parentsTopPositions += parseFloat(firstParent.style.top)
                        firstParent = secondParent
                        secondParent = firstParent.parentElement
                        tries++
                    }
                    return (parseFloat(elem.style.top) + parentsTopPositions)
                }

                // PAGE VARIABLES
                let currentObjects
                const pageChangedFunction = pag => {
                    pageNum = pag.getPageNumber()
                    pageTop = document.querySelector('div.page-viewport.top')
                    pinnedContainer = pageTop.querySelector('div.pinned-container')
                    pageContainer = pageTop.querySelector('div.page-container')
                    pageScroll = pageContainer.querySelector('div.page-scroll')

                    // CHECKING IF THERE IS PINNED CONTAINER
                    isContainer = pinnedContainer!=undefined
                    appendingContainer = isContainer===true ? pinnedContainer : pageContainer 

                    currentObjects = scrollObjects.filter(scr => scr.object.page.pageNumber==pageNum)
                    if(pageTop.visited===undefined){
                        // SETTING ANCHORS
                        let pageTopAnchor = document.getElementById(`page-${pageNum}-top`)
                        let pageBottomAnchor = document.getElementById(`page-${pageNum}-bottom`)
                        pageScroll.prepend(pageTopAnchor)
                        pageScroll.append(pageBottomAnchor)
                        let pageAnchors = Array.from(pageScroll.querySelectorAll(".scranchor"))
                        for(let j=0; j<pageAnchors.length; j++){
                            if(pageAnchors[j].parentElement!=pageScroll){
                                pageAnchors[j].style.top = (`${ getDistance(pageAnchors[j]) }px`)
                                pageAnchors[j-1].after(pageAnchors[j])
                            }
                        }
                        pageAnchors.sort(compareTopValues)

                        // CREATING AN ARRAY OF SCROLLING OBJECTS
                        let onScrolls = allOnScrolls.filter(scrol => scrol.page.pageNumber==pageNum)
                        for(let onScroll of onScrolls){
                            let nod = document.getElementById(onScroll.id)
                            allTags = onScroll.tags
                            let pinned = allTags.includes('pinned-position')

                            // DEFINING DEFAULT EFFECTS VALUES
                            let defaultLocals = [1,0]
                            let locals = onScroll.getPayload().split(',')
                            let local = locals.map(loc => parseFloat(loc))
                            for(let l=0; l<defaultLocals.length; l++)
                                local[l] = isNaN(local[l]) ? defaultLocals[l] : local[l]

                            // DEFINING EFFECTS
                            let scrollEffects = allTags.filter(tag => tag.includes(strings[0]))
                            if(scrollEffects.length===0 && pinned===false){
                                console.warn('missing tags for "onScroll" effect: ', onScroll)
                                continue
                            }
                            scrollEffects = scrollEffects.map(scrollEffect => scrollEffect.slice(strings[0].length, scrollEffect.length).split(','))
                            let eff = scrollEffects.map(
                                ef => {
                                    let obj = {
                                        name: ef[0] ?? 'effect name is missing',
                                        intensity: ef[1]!=undefined ? parseFloat(ef[1]) : local[0],
                                        offset: ef[2]!=undefined ? Math.abs( parseFloat(ef[2]) ) : local[1]
                                    }
                                    obj.float = obj.intensity<0 ? 1 : 0
                                    return obj
                                }
                            )

                            // DEFINING RANGE
                            let defaultRange = `${strings[1]}0,${pageHeight}`
                            let scrollRange = allTags.find(tag => tag.includes(strings[1])) ?? defaultRange
                            scrollRange = scrollRange.slice(strings[1].length, scrollRange.length).split(',')
                            
                            let beginning = getDistance(nod) - parseFloat(scrollRange[0])
                            let finish = scrollRange.length>1 ? scrollRange[scrollRange.length-1] : pageHeight
                            let ranges = [scrollRange[0], finish]
                            for(let r=0; r<ranges.length; r++){
                                if(typeof ranges[r]!='string')
                                    continue

                                const number = ranges[r].substring(1)
                                if(ranges[r].includes('b') && r===0){
                                    beginning = parseFloat(number)
                                    ranges[r] = getDistance(nod) - beginning
                                    continue
                                }
                                if(ranges[r].includes('a') && r===0)
                                    beginning = Math.max(getDistance(nod) - parseFloat(pageAnchors[parseInt(number, 10)].style.top), 0)
                                if(ranges[r].includes('a')){
                                    let anchor = parseInt(number, 10)
                                    ranges[r] = pageAnchors[anchor].style.top
                                    continue
                                }
                                if(ranges[r].includes('+') && r==ranges.length-1)
                                    ranges[r] = parseFloat(number) + parseFloat(ranges[0])
                            }
                            ranges = ranges.map(ran => parseFloat(ran))
                            if(ranges.includes(NaN))
                                ranges = [0, pageHeight]
                            let clicked = ranges[0]===0

                            // DEFINING INITIAL POSITION
                            if(onScroll.isGroup()) {
                                if(onScroll.x==undefined || onScroll.y==undefined){
                                    onScroll.x = parseFloat(nod.style.left)
                                    onScroll.y = parseFloat(nod.style.top)
                                }
                            }
                            let pos = {x: onScroll.getX(), y: onScroll.getY()}

                            currentObjects.push(new ScrollObject(onScroll, nod, nod.parentElement, pos, eff, beginning, ranges[0], ranges[1], local, pinned, clicked))
                        }
                        scrollObjects.push(...currentObjects)

                        pageContainer.addEventListener("scroll", function(){ scrollFunction(pageContainer, currentObjects) })
                    }

                    scrollObjects.forEach(s => s.isClicked = s.start===0)
                    scrollFunction(pageContainer, currentObjects)
                    pageTop.visited ??= true
                    window.scrollersArray = scrollObjects
                }
                experience.on(CerosSDK.EVENTS.PAGE_CHANGED, pageChangedFunction)
                
                const allScrollEffects = [
                    'horizontal-movement',
                    'vertical-movement',
                    'rotation',
                    'blur', 
                    // SWITCHING FORMULA FROM THIS POINT (4)
                    'scale-both',
                    'scale-width',
                    'scale-height',
                    'opacity',
                    'crop-rectangle',
                    'crop-circle'
                ]
                    
                const scrollFunction = (pageCont, scrollObjs) => {
                    const scrollT = pageCont.scrollTop

                    for(let scrollObj of scrollObjs){
                        let allEffects = scrollObj.effects
                        let effect = null

                        let difference = scrollObj.end-scrollObj.start
                        let percentage = (scrollT-scrollObj.start) / difference
                        let percent = percentage<0 ? Math.max(percentage, 0) : Math.min(percentage, 1)
                        percentage = parseFloat(percentage.toFixed(2))

                        // CASE FOR PINNED POSITION
                        if(scrollObj.isPinned){
                            if(scrollT<scrollObj.start){
                                scrollObj.node.style.top = `${scrollObj.position.y}px`
                            }
                            if(scrollT>=scrollObj.start && scrollT<scrollObj.end){
                                scrollObj.node.style.top = `${scrollObj.margin}px`
                                if(scrollObj.node.classList.contains('pin')===false){
                                    appendingContainer.append(scrollObj.node)
                                    if(isContainer===false)
                                        scrollObj.node.style.position = 'sticky'
                                    scrollObj.node.classList.add('pin')
                                }
                            }
                            if(scrollT>=scrollObj.end){
                                scrollObj.node.style.top = `${scrollObj.end + scrollObj.margin}px`
                            }
                            if((scrollT<scrollObj.start || scrollT>=scrollObj.end) && scrollObj.node.classList.contains('pin')){
                                scrollObj.parentElem.append(scrollObj.node)
                                scrollObj.node.style.position = 'absolute'
                                scrollObj.node.classList.remove('pin')
                            }
                        }
                        
                        // CASE FOR CLICKER
                        effect = allEffects.find(ee => ee.name==='clicker')
                        if(effect){
                            if((percentage>=0 && percentage<1 && scrollObj.isClicked===false) || ((percentage>=1 || percentage<0) && scrollObj.isClicked===true)){
                                if(scrollObj.node.style.display!='none')
                                    scrollObj.object.click()
                                scrollObj.isClicked = !scrollObj.isClicked
                            }
                        }

                        // APPLYING EFFECTS
                        let cssStyle = scrollObj.node.style
                        for(let i=0; i<allScrollEffects.length; i++){
                            effect = allEffects.find(e => e.name===allScrollEffects[i])
                            if(effect){
                                let val = (effect.float+effect.intensity*percent)*difference + effect.offset*Math.sign(effect.intensity)*difference
                                if(i>=4)
                                    val = (effect.float+effect.intensity*percent) + effect.offset
                                switch(allScrollEffects[i]){
                                    case 'horizontal-movement':
                                        cssStyle.setProperty('left', `${scrollObj.position.x + val}px`)
                                        continue
                                    case 'vertical-movement':
                                        cssStyle.setProperty('top', `${scrollObj.position.y + val}px`)
                                        continue
                                    case 'rotation':
                                        cssStyle.setProperty('rotate', `${val}deg`)
                                        continue
                                    case 'blur':
                                        cssStyle.setProperty('filter', `blur(${val/100}px)`)
                                        continue
                                    case 'scale-both':
                                        cssStyle.setProperty('scale', val)
                                        continue
                                    case 'scale-width':
                                        cssStyle.setProperty('scale', `${val} 1`)
                                        continue
                                    case 'scale-height':
                                        cssStyle.setProperty('scale', `1 ${val}`)
                                        continue
                                    case 'opacity':
                                        cssStyle.setProperty('opacity', val)
                                        continue
                                    case 'crop-rectangle':
                                        cssStyle.setProperty('clip-path', `inset(0 0 0 ${val*100}%)`)
                                        continue
                                    case 'crop-circle':
                                        cssStyle.setProperty('clip-path', `circle(${val*50}% at 50% 50%)`)
                                        continue
                                }
                            }
                        }
                    }
                }
            })
    }); 
})();
